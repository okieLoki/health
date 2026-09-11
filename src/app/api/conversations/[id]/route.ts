import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

const patchSchema = z.object({ title: z.string().min(1).max(120) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { title } = patchSchema.parse(await req.json());
    const [row] = await db
      .update(conversations)
      .set({ title })
      .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
      .returning();
    if (!row) return ok({ error: "Not found" }, 404);
    return ok({ conversation: row });
  } catch (e) {
    return apiError(e);
  }
}

/** Deleting a thread removes its messages, never the food or workouts it logged. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [row] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
      .returning();
    if (!row) return ok({ error: "Not found" }, 404);
    return ok({ deleted: row.id });
  } catch (e) {
    return apiError(e);
  }
}
