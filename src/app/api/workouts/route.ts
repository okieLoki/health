import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { weightLogs, workouts } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { analyzeWorkout } from "@/lib/gemini";
import { timeInTz } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, user.id), gte(workouts.performedAt, since)))
      .orderBy(desc(workouts.performedAt));
    return ok({ workouts: rows });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  text: z.string().min(2).max(4000),
  performedAt: z.string().datetime().optional(),
  kind: z.enum(["gym", "walk", "run", "cardio", "sport", "other"]).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    const body = schema.parse(await req.json());
    const performedAt = body.performedAt ? new Date(body.performedAt) : new Date();

    // Calorie burn and bodyweight-movement volume both need current weight.
    const latestWeight = await db.query.weightLogs.findFirst({
      where: eq(weightLogs.userId, user.id),
      orderBy: desc(weightLogs.measuredAt),
    });

    const analysis = await analyzeWorkout({
      text: body.text,
      bodyWeightKg: latestWeight?.weightKg ?? null,
      localTime: timeInTz(performedAt, profile.timezone),
    });

    const [row] = await db
      .insert(workouts)
      .values({
        userId: user.id,
        kind: body.kind ?? analysis.kind,
        title: analysis.title,
        notes: body.text,
        performedAt,
        durationMin: analysis.durationMin ?? null,
        caloriesBurned: analysis.caloriesBurned ?? null,
        distanceKm: analysis.distanceKm ?? null,
        exercises: analysis.exercises,
        totalVolumeKg: analysis.totalVolumeKg ?? null,
        source: "text",
        aiNotes: analysis.notes,
      })
      .returning();

    return ok({ workout: row }, 201);
  } catch (e) {
    return apiError(e);
  }
}
