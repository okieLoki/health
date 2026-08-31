import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { weightLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const days = Number(new URL(req.url).searchParams.get("days") ?? 90);
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db
      .select()
      .from(weightLogs)
      .where(and(eq(weightLogs.userId, user.id), gte(weightLogs.measuredAt, since)))
      .orderBy(desc(weightLogs.measuredAt));
    return ok({ entries: rows });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  weightKg: z.coerce.number().min(20).max(400),
  bodyFatPct: z.coerce.number().min(1).max(70).optional().nullable(),
  measuredAt: z.string().datetime().optional(),
  note: z.string().max(280).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const [row] = await db
      .insert(weightLogs)
      .values({
        userId: user.id,
        weightKg: body.weightKg,
        bodyFatPct: body.bodyFatPct ?? null,
        measuredAt: body.measuredAt ? new Date(body.measuredAt) : new Date(),
        note: body.note ?? null,
        source: "manual",
      })
      .returning();
    return ok({ entry: row }, 201);
  } catch (e) {
    return apiError(e);
  }
}
