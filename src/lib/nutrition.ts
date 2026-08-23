export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (1-3 workouts a week)",
  moderate: "Moderate (3-5 workouts a week)",
  active: "Active (6-7 workouts a week)",
  very_active: "Very active (hard training or physical job)",
};

/** Energy in 1 kg of body fat. The number behind every deficit calculation. */
export const KCAL_PER_KG_FAT = 7700;

export function ageFrom(birthDate: string, on: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = on.getUTCFullYear() - y;
  const hadBirthday =
    on.getUTCMonth() + 1 > m || (on.getUTCMonth() + 1 === m && on.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/** Mifflin-St Jeor, the most accurate general BMR equation. */
export function bmr(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: string | null;
}): number {
  const base = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age;
  return opts.sex === "female" ? base - 161 : base + 5;
}

/**
 * Daily burn. When Apple Watch active energy is available we use it instead of
 * a guessed activity multiplier, a measured number beats a lifestyle bucket.
 * Active energy excludes resting burn and excludes the ~10% thermic effect of
 * food, so we add resting back and gross up by 10%.
 */
export function tdee(opts: {
  bmrKcal: number;
  activityLevel: ActivityLevel;
  activeEnergyKcal?: number | null;
}): { value: number; basis: "measured" | "estimated" } {
  if (opts.activeEnergyKcal && opts.activeEnergyKcal > 50) {
    return { value: (opts.bmrKcal + opts.activeEnergyKcal) / 0.9, basis: "measured" };
  }
  return {
    value: opts.bmrKcal * ACTIVITY_MULTIPLIER[opts.activityLevel],
    basis: "estimated",
  };
}

/** Never prescribe below this, regardless of what the deficit math says. */
export function calorieFloor(sex: string | null, bmrKcal: number): number {
  return Math.max(sex === "female" ? 1200 : 1500, Math.round(bmrKcal));
}

export function calorieTarget(opts: {
  tdeeKcal: number;
  goal: string;
  weeklyRateKg: number;
  bmrKcal: number;
  sex: string | null;
  override?: number | null;
}): { target: number; dailyDelta: number; clamped: boolean } {
  if (opts.override) return { target: opts.override, dailyDelta: opts.override - opts.tdeeKcal, clamped: false };
  const sign = opts.goal === "lose" ? -1 : opts.goal === "gain" ? 1 : 0;
  const dailyDelta = (sign * opts.weeklyRateKg * KCAL_PER_KG_FAT) / 7;
  const raw = opts.tdeeKcal + dailyDelta;
  const floor = calorieFloor(opts.sex, opts.bmrKcal);
  const target = Math.max(raw, floor);
  return { target: Math.round(target), dailyDelta: Math.round(dailyDelta), clamped: target > raw };
}

/**
 * Protein high enough to protect muscle in a deficit, fat at 25% of calories
 * for hormone health, carbs take whatever is left.
 */
