import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [row] = await db
      .delete(waterLogs)
      .where(and(eq(waterLogs.id, id), eq(waterLogs.userId, user.id)))
      .returning();
    if (!row) return ok({ error: "Not found" }, 404);
    return ok({ deleted: row.id });
  } catch (e) {
    return apiError(e);
  }
}
