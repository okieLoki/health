import { createNeonAuth } from "@neondatabase/auth/next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;

/**
 * Neon Auth (Managed Better Auth). Identity lives in Neon's auth service; we
 * keep a thin local `users` row so every other table can hang off a real FK.
 */
export const auth = createNeonAuth({
  baseUrl: baseUrl ?? "http://neon-auth-not-configured.invalid",
  cookies: { secret: secret ?? "development-placeholder-secret-min-32-chars!!" },
});

export const authConfigured = () => Boolean(baseUrl && secret && secret.length >= 32);

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

type AuthUser = { id: string; email: string; name?: string | null; image?: string | null };

/** Mirror the Neon Auth identity into our own table, once, on first sight. */
async function syncUser(authUser: AuthUser) {
  const [row] = await db
    .insert(users)
    .values({
      authId: authUser.id,
      email: authUser.email,
      name: authUser.name ?? null,
      image: authUser.image ?? null,
    })
    .onConflictDoUpdate({
      target: users.authId,
      set: { email: authUser.email, name: authUser.name ?? null, image: authUser.image ?? null },
    })
    .returning();

  await db
    .insert(profiles)
    .values({ userId: row.id, ingestToken: newIngestToken() })
    .onConflictDoNothing();
  return row;
}

export async function getSessionUser() {
  if (!authConfigured()) return null;
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;
    return await syncUser(session.user as AuthUser);
  } catch {
    return null;
  }
}

/** Throws if unauthenticated, first line of every protected route handler. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** 32 hex chars, long enough to live in a Shortcut on your phone. */
export function newIngestToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getProfile(userId: string) {
  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (existing) return existing;
  const [created] = await db
    .insert(profiles)
    .values({ userId, ingestToken: newIngestToken() })
    .returning();
  return created;
}

export type Profile = Awaited<ReturnType<typeof getProfile>>;
