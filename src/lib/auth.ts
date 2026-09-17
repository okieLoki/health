import { cache } from "react";
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
  // The SDK's default 5 minute session cache measured no slower than 10, so
  // there is no reason to widen the window a revoked session stays valid.
  cookies: { secret: secret ?? "development-placeholder-secret-min-32-chars!!" },
});

export const authConfigured = () => Boolean(baseUrl && secret && secret.length >= 32);

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

type AuthUser = { id: string; email: string; name?: string | null; image?: string | null };

/**
 * Mirror the Neon Auth identity into our own table.
 *
 * This runs on every authenticated request, so the steady state must be a
 * single read. Writing unconditionally cost two round trips per request, to a
 * database in another region, to store values that almost never change.
 */
async function syncUser(authUser: AuthUser) {
  const name = authUser.name ?? null;
  const image = authUser.image ?? null;

  const existing = await db.query.users.findFirst({ where: eq(users.authId, authUser.id) });
  if (existing) {
    const unchanged =
      existing.email === authUser.email && existing.name === name && existing.image === image;
    if (unchanged) return existing;

    const [updated] = await db
      .update(users)
      .set({ email: authUser.email, name, image })
      .where(eq(users.authId, authUser.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(users)
    .values({ authId: authUser.id, email: authUser.email, name, image })
    .onConflictDoUpdate({
      target: users.authId,
      set: { email: authUser.email, name, image },
    })
    .returning();

  // Only a brand new user needs a profile row.
  await db
    .insert(profiles)
    .values({ userId: row.id, ingestToken: newIngestToken() })
    .onConflictDoNothing();
  return row;
}

/**
 * Cached for the life of one request. The app layout and the page beneath it
 * both need the user, and without this each render hit the Neon Auth service
 * twice and synced the user twice.
 */
export const getSessionUser = cache(async () => {
  if (!authConfigured()) return null;
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;
    return await syncUser(session.user as AuthUser);
  } catch {
    return null;
  }
});

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

/** Cached per request for the same reason as getSessionUser. */
export const getProfile = cache(async (userId: string) => {
  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (existing) return existing;
  const [created] = await db
    .insert(profiles)
    .values({ userId, ingestToken: newIngestToken() })
    .returning();
  return created;
});

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
