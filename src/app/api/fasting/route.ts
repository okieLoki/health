import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fastingSessions } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const [open, recent] = await Promise.all([
      db.query.fastingSessions.findFirst({
        where: and(eq(fastingSessions.userId, user.id), isNull(fastingSessions.endedAt)),
        orderBy: desc(fastingSessions.startedAt),
      }),
      db
        .select()
        .from(fastingSessions)
        .where(eq(fastingSessions.userId, user.id))
        .orderBy(desc(fastingSessions.startedAt))
        .limit(30),
    ]);
    return ok({ open: open ?? null, recent });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    startedAt: z.string().datetime().optional(),
    targetHours: z.coerce.number().min(1).max(168).optional(),
    note: z.string().max(280).optional(),
  }),
  z.object({ action: z.literal("end"), endedAt: z.string().datetime().optional() }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    const body = schema.parse(await req.json());

    if (body.action === "start") {
      // Close any fast left hanging rather than stacking two open ones.
      await db
        .update(fastingSessions)
        .set({ endedAt: new Date() })
        .where(and(eq(fastingSessions.userId, user.id), isNull(fastingSessions.endedAt)));

      const [row] = await db
        .insert(fastingSessions)
        .values({
          userId: user.id,
          startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
          targetHours: body.targetHours ?? profile.fastingTargetHours,
          note: body.note ?? null,
        })
        .returning();
      return ok({ session: row }, 201);
    }

    const [row] = await db
      .update(fastingSessions)
      .set({ endedAt: body.endedAt ? new Date(body.endedAt) : new Date() })
      .where(and(eq(fastingSessions.userId, user.id), isNull(fastingSessions.endedAt)))
      .returning();
    if (!row) return ok({ error: "No fast is running." }, 409);
    return ok({ session: row });
  } catch (e) {
    return apiError(e);
  }
}
