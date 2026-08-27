import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fastingSessions,
  foodLogs,
  healthDays,
  waterLogs,
  weightLogs,
  workouts,
} from "@/db/schema";
import { getProfile, type Profile } from "./auth";
import { dayRange, lastNDayKeys, shiftDayKey, todayKey } from "./dates";
import {
  ageFrom,
  bmi,
  bmr,
  calorieTarget,
  macroTargets,
  movingAverage,
  tdee,
  weightTrendPerWeek,
  type ActivityLevel,
} from "./nutrition";

export type Targets = {
  bmr: number | null;
  tdee: number | null;
  tdeeBasis: "measured" | "estimated" | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  dailyDelta: number | null;
  clamped: boolean;
  bmi: number | null;
  age: number | null;
  /** Which profile fields still need filling before targets can be computed. */
  missing: string[];
};

export function deriveTargets(
  profile: Profile,
  weightKg: number | null,
  activeEnergyKcal: number | null,
): Targets {
  const missing: string[] = [];
  if (!profile.heightCm) missing.push("height");
  if (!profile.birthDate) missing.push("date of birth");
  if (!profile.sex) missing.push("sex");
  if (!weightKg) missing.push("a weight entry");

  const empty: Targets = {
    bmr: null, tdee: null, tdeeBasis: null, calories: null, proteinG: null,
    carbsG: null, fatG: null, dailyDelta: null, clamped: false, bmi: null,
    age: null, missing,
  };
  if (missing.length || !weightKg || !profile.heightCm || !profile.birthDate) return empty;

  const age = ageFrom(profile.birthDate);
  const bmrKcal = bmr({ weightKg, heightCm: profile.heightCm, age, sex: profile.sex });
  const burn = tdee({
    bmrKcal,
    activityLevel: (profile.activityLevel as ActivityLevel) ?? "light",
    activeEnergyKcal,
  });
  const target = calorieTarget({
    tdeeKcal: burn.value,
    goal: profile.goal,
    weeklyRateKg: profile.weeklyRateKg,
    bmrKcal,
    sex: profile.sex,
    override: profile.calorieTargetOverride,
  });
  const macros = macroTargets({ calories: target.target, weightKg, goal: profile.goal });

  return {
    bmr: Math.round(bmrKcal),
    tdee: Math.round(burn.value),
    tdeeBasis: burn.basis,
    calories: target.target,
    proteinG: profile.proteinTargetG ?? macros.proteinG,
    carbsG: profile.carbTargetG ?? macros.carbsG,
    fatG: profile.fatTargetG ?? macros.fatG,
    dailyDelta: target.dailyDelta,
    clamped: target.clamped,
    bmi: bmi(weightKg, profile.heightCm),
    age,
    missing,
  };
}

export type DaySummary = Awaited<ReturnType<typeof getDaySummary>>;

export async function getDaySummary(userId: string, key?: string) {
  const profile = await getProfile(userId);
  const tz = profile.timezone;
  const day = key ?? todayKey(tz);
  const { start, end } = dayRange(day, tz);

  const [meals, water, sessions, health, latestWeight, dayWeights, openFast, prevMeal] =
    await Promise.all([
      db
        .select()
        .from(foodLogs)
        .where(and(eq(foodLogs.userId, userId), gte(foodLogs.eatenAt, start), lte(foodLogs.eatenAt, end)))
        .orderBy(asc(foodLogs.eatenAt)),
      db
        .select()
        .from(waterLogs)
        .where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, start), lte(waterLogs.loggedAt, end)))
        .orderBy(asc(waterLogs.loggedAt)),
      db
        .select()
        .from(workouts)
        .where(and(eq(workouts.userId, userId), gte(workouts.performedAt, start), lte(workouts.performedAt, end)))
        .orderBy(asc(workouts.performedAt)),
      db.query.healthDays.findFirst({
        where: and(eq(healthDays.userId, userId), eq(healthDays.day, day)),
      }),
      db.query.weightLogs.findFirst({
        where: and(eq(weightLogs.userId, userId), lte(weightLogs.measuredAt, end)),
        orderBy: desc(weightLogs.measuredAt),
      }),
      db
        .select()
        .from(weightLogs)
        .where(and(eq(weightLogs.userId, userId), gte(weightLogs.measuredAt, start), lte(weightLogs.measuredAt, end)))
        .orderBy(asc(weightLogs.measuredAt)),
      db.query.fastingSessions.findFirst({
        where: and(eq(fastingSessions.userId, userId), isNull(fastingSessions.endedAt)),
        orderBy: desc(fastingSessions.startedAt),
      }),
      // Last meal at or before this day's end, may be from yesterday.
      db.query.foodLogs.findFirst({
        where: and(eq(foodLogs.userId, userId), lte(foodLogs.eatenAt, end)),
        orderBy: desc(foodLogs.eatenAt),
      }),
    ]);

  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      proteinG: a.proteinG + m.proteinG,
      carbsG: a.carbsG + m.carbsG,
      fatG: a.fatG + m.fatG,
      fiberG: a.fiberG + (m.fiberG ?? 0),
      sugarG: a.sugarG + (m.sugarG ?? 0),
      sodiumMg: a.sodiumMg + (m.sodiumMg ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  // Undo entries are negative rows, so a day can net below zero; never show that.
  const waterMl = Math.max(0, water.reduce((a, w) => a + w.amountMl, 0));
  const workoutKcal = sessions.reduce((a, w) => a + (w.caloriesBurned ?? 0), 0);
  const targets = deriveTargets(profile, latestWeight?.weightKg ?? null, health?.activeEnergyKcal ?? null);

  // Prefer the watch's measured burn; fall back to estimated TDEE + logged workouts.
  const burned = health?.activeEnergyKcal
    ? targets.tdee
    : targets.tdee != null
      ? targets.tdee + workoutKcal
      : null;

  const firstMeal = meals[0]?.eatenAt ?? null;
  const lastMeal = meals[meals.length - 1]?.eatenAt ?? null;
  const fastStart = openFast?.startedAt ?? prevMeal?.eatenAt ?? null;
  const isToday = day === todayKey(tz);
  const fastReference = isToday ? new Date() : end;

  return {
    day,
    tz,
    profile,
    targets,
    meals,
    water,
    workouts: sessions,
    health: health ?? null,
    latestWeight: latestWeight ?? null,
    dayWeights,
    totals,
    waterMl,
    workoutKcal,
    burned,
    netKcal: burned != null ? Math.round(totals.calories - burned) : null,
    fasting: {
      /** Open explicit fast, or time since the last thing eaten. */
      since: fastStart,
      hours: fastStart ? (fastReference.getTime() - fastStart.getTime()) / 3_600_000 : null,
      explicit: Boolean(openFast),
      targetHours: openFast?.targetHours ?? profile.fastingTargetHours,
      firstMeal,
      lastMeal,
      eatingWindowHours:
        firstMeal && lastMeal ? (lastMeal.getTime() - firstMeal.getTime()) / 3_600_000 : null,
    },
  };
}

export type TrendPoint = {
  day: string;
  weightKg: number | null;
  weightTrendKg: number | null;
  calories: number | null;
  burned: number | null;
  net: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  steps: number | null;
  waterMl: number | null;
  workoutMin: number | null;
  fastHours: number | null;
};

/** One pass over the window, bucketed in the user's timezone by Postgres. */
export async function getTrend(userId: string, days = 30): Promise<TrendPoint[]> {
  const profile = await getProfile(userId);
  const tz = profile.timezone;
  const keys = lastNDayKeys(days, tz);
  const { start } = dayRange(keys[0], tz);
  const { end } = dayRange(keys[keys.length - 1], tz);

  const bucket = (col: string) => sql.raw(`to_char(${col} AT TIME ZONE '${tz.replace(/'/g, "")}', 'YYYY-MM-DD')`);

  const [foodRows, waterRows, weightRows, workoutRows, healthRows] = await Promise.all([
    db
      .select({
        day: bucket("eaten_at").as("day"),
        calories: sql<number>`sum(${foodLogs.calories})`,
        proteinG: sql<number>`sum(${foodLogs.proteinG})`,
        carbsG: sql<number>`sum(${foodLogs.carbsG})`,
        fatG: sql<number>`sum(${foodLogs.fatG})`,
        firstAt: sql<Date>`min(${foodLogs.eatenAt})`,
        lastAt: sql<Date>`max(${foodLogs.eatenAt})`,
      })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.eatenAt, start), lte(foodLogs.eatenAt, end)))
      .groupBy(bucket("eaten_at")),
    db
      .select({ day: bucket("logged_at").as("day"), ml: sql<number>`sum(${waterLogs.amountMl})` })
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, start), lte(waterLogs.loggedAt, end)))
      .groupBy(bucket("logged_at")),
    db
      .select({ day: bucket("measured_at").as("day"), kg: sql<number>`avg(${weightLogs.weightKg})` })
      .from(weightLogs)
      .where(and(eq(weightLogs.userId, userId), gte(weightLogs.measuredAt, start), lte(weightLogs.measuredAt, end)))
      .groupBy(bucket("measured_at")),
    db
      .select({
        day: bucket("performed_at").as("day"),
        minutes: sql<number>`sum(coalesce(${workouts.durationMin}, 0))`,
        kcal: sql<number>`sum(coalesce(${workouts.caloriesBurned}, 0))`,
      })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.performedAt, start), lte(workouts.performedAt, end)))
      .groupBy(bucket("performed_at")),
    db
      .select()
      .from(healthDays)
      .where(and(eq(healthDays.userId, userId), gte(healthDays.day, keys[0]), lte(healthDays.day, keys[keys.length - 1]))),
  ]);

  const food = new Map(foodRows.map((r) => [r.day, r]));
  const water = new Map(waterRows.map((r) => [r.day, Number(r.ml)]));
  const weight = new Map(weightRows.map((r) => [r.day, Number(r.kg)]));
  const work = new Map(workoutRows.map((r) => [r.day, r]));
  const health = new Map(healthRows.map((r) => [r.day, r]));

  const rawWeights = keys.map((k) => weight.get(k) ?? null);
  const smoothed = movingAverage(rawWeights, 7);

  return keys.map((k, i) => {
    const f = food.get(k);
    const w = work.get(k);
    const h = health.get(k);
    const weightKg = rawWeights[i];
    const targets = deriveTargets(profile, weightKg ?? null, h?.activeEnergyKcal ?? null);
    const burned = h?.activeEnergyKcal
      ? targets.tdee
      : targets.tdee != null
        ? targets.tdee + Number(w?.kcal ?? 0)
        : null;
    const calories = f ? Number(f.calories) : null;

    // Fast length = gap between yesterday's last meal and today's first.
    const prev = food.get(shiftDayKey(k, -1));
    const fastHours =
      prev?.lastAt && f?.firstAt
        ? (new Date(f.firstAt).getTime() - new Date(prev.lastAt).getTime()) / 3_600_000
        : null;

    return {
      day: k,
      weightKg,
      weightTrendKg: smoothed[i] != null ? Math.round(smoothed[i]! * 100) / 100 : null,
      calories: calories != null ? Math.round(calories) : null,
      burned: burned != null ? Math.round(burned) : null,
      net: calories != null && burned != null ? Math.round(calories - burned) : null,
      proteinG: f ? Math.round(Number(f.proteinG)) : null,
      carbsG: f ? Math.round(Number(f.carbsG)) : null,
      fatG: f ? Math.round(Number(f.fatG)) : null,
      steps: h?.steps ?? null,
      waterMl: water.has(k) ? Math.max(0, water.get(k)!) : null,
      workoutMin: w ? Math.round(Number(w.minutes)) : null,
      fastHours: fastHours != null ? Math.round(fastHours * 10) / 10 : null,
    };
  });
}

/** kg/week from the smoothed series, the number that says if this is working. */
export function trendRate(points: TrendPoint[]): number | null {
  const usable = points
    .filter((p) => p.weightTrendKg != null)
    .map((p) => ({ t: new Date(`${p.day}T12:00:00Z`).getTime(), kg: p.weightTrendKg! }));
  const slope = weightTrendPerWeek(usable);
  return slope == null ? null : Math.round(slope * 100) / 100;
}
