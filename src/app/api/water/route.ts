import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { dayRange, todayKey } from "@/lib/dates";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    const day = new URL(req.url).searchParams.get("day") ?? todayKey(profile.timezone);
    const { start, end } = dayRange(day, profile.timezone);
    const rows = await db
      .select()
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, user.id), gte(waterLogs.loggedAt, start), lte(waterLogs.loggedAt, end)))
      .orderBy(desc(waterLogs.loggedAt));
    return ok({ entries: rows, totalMl: rows.reduce((a, r) => a + r.amountMl, 0) });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  /** Negative is allowed so a mis-tap can be undone. */
  amountMl: z.coerce.number().int().min(-5000).max(5000).refine((v) => v !== 0),
  loggedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const [row] = await db
      .insert(waterLogs)
      .values({
        userId: user.id,
        amountMl: body.amountMl,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
      })
      .returning();
    return ok({ entry: row }, 201);
  } catch (e) {
    return apiError(e);
  }
}
