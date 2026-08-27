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
