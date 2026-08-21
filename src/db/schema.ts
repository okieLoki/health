import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One component of a meal, as resolved by the LLM. */
export type FoodItem = {
  name: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
};

/** One exercise inside a gym session, as resolved by the LLM. */
export type Exercise = {
  name: string;
  sets?:
    | {
        reps?: number | null;
        weightKg?: number | null;
        distanceKm?: number | null;
        durationMin?: number | null;
      }[]
    | null;
  volumeKg?: number | null;
  notes?: string | null;
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Neon Auth user id. Our own uuid stays the FK everything else hangs off. */
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  heightCm: real("height_cm"),
  birthDate: date("birth_date"),
  /** "male" | "female", Mifflin-St Jeor needs a biological-sex constant. */
  sex: text("sex"),
  /** sedentary | light | moderate | active | very_active */
  activityLevel: text("activity_level").notNull().default("light"),
  /** lose | maintain | gain */
  goal: text("goal").notNull().default("lose"),
  targetWeightKg: real("target_weight_kg"),
  /** kg per week; positive = losing that fast. */
  weeklyRateKg: real("weekly_rate_kg").notNull().default(0.5),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  waterTargetMl: integer("water_target_ml").notNull().default(3000),
  stepTarget: integer("step_target").notNull().default(10000),
  fastingTargetHours: real("fasting_target_hours").notNull().default(16),
  /** Set to override the computed deficit target. */
  calorieTargetOverride: integer("calorie_target_override"),
  proteinTargetG: integer("protein_target_g"),
  carbTargetG: integer("carb_target_g"),
  fatTargetG: integer("fat_target_g"),
  /** Secret the iOS Shortcut posts with, identifies the user, rotatable. */
  ingestToken: text("ingest_token").notNull().unique(),
  /** Daily email report on/off, and the local hour it should land. */
  reportEnabled: text("report_enabled").notNull().default("true"),
  reportHour: integer("report_hour").notNull().default(21),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
