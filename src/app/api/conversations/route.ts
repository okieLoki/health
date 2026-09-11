import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(50);
    return ok({ conversations: rows });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const [row] = await db.insert(conversations).values({ userId: user.id }).returning();
    return ok({ conversation: row }, 201);
  } catch (e) {
    return apiError(e);
  }
}
