import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser, getProfile, newIngestToken } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

/** Rotate the Shortcut's token, the old one stops working immediately. */
export async function POST() {
  try {
    const user = await requireUser();
    await getProfile(user.id);
    const [row] = await db
      .update(profiles)
      .set({ ingestToken: newIngestToken(), updatedAt: new Date() })
      .where(eq(profiles.userId, user.id))
      .returning();
    return ok({ ingestToken: row.ingestToken });
  } catch (e) {
    return apiError(e);
  }
}
