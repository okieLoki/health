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

export const weightLogs = pgTable(
  "weight_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weightKg: real("weight_kg").notNull(),
    bodyFatPct: real("body_fat_pct"),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
    /** manual | apple | import */
    source: text("source").notNull().default("manual"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("weight_user_time_idx").on(t.userId, t.measuredAt)],
);

export const foodLogs = pgTable(
  "food_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** breakfast | lunch | dinner | snack */
    mealType: text("meal_type").notNull().default("snack"),
    eatenAt: timestamp("eaten_at", { withTimezone: true }).notNull().defaultNow(),
    calories: real("calories").notNull().default(0),
    proteinG: real("protein_g").notNull().default(0),
    carbsG: real("carbs_g").notNull().default(0),
    fatG: real("fat_g").notNull().default(0),
    fiberG: real("fiber_g"),
    sugarG: real("sugar_g"),
    sodiumMg: real("sodium_mg"),
    items: jsonb("items").$type<FoodItem[]>(),
    /** manual | photo | text */
    source: text("source").notNull().default("text"),
    /** 0..1, how sure the model was. */
    confidence: real("confidence"),
    imageUrl: text("image_url"),
    aiNotes: text("ai_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("food_user_time_idx").on(t.userId, t.eatenAt)],
);

export const waterLogs = pgTable(
  "water_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMl: integer("amount_ml").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("water_user_time_idx").on(t.userId, t.loggedAt)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** gym | walk | run | cardio | sport | other */
    kind: text("kind").notNull().default("gym"),
    title: text("title").notNull(),
    /** Exactly what you typed, kept verbatim. */
    notes: text("notes"),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    durationMin: real("duration_min"),
    caloriesBurned: real("calories_burned"),
    distanceKm: real("distance_km"),
    exercises: jsonb("exercises").$type<Exercise[]>(),
    /** Sum of reps x weight across all sets, the number that should trend up. */
    totalVolumeKg: real("total_volume_kg"),
    source: text("source").notNull().default("text"),
    aiNotes: text("ai_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workout_user_time_idx").on(t.userId, t.performedAt)],
);

/** One row per calendar day, upserted by the iOS Shortcut. */
export const healthDays = pgTable(
  "health_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    steps: integer("steps"),
    activeEnergyKcal: real("active_energy_kcal"),
    basalEnergyKcal: real("basal_energy_kcal"),
    exerciseMin: real("exercise_min"),
    standHours: integer("stand_hours"),
    distanceKm: real("distance_km"),
    flightsClimbed: integer("flights_climbed"),
    restingHr: real("resting_hr"),
    avgHr: real("avg_hr"),
    sleepMin: real("sleep_min"),
    source: text("source").notNull().default("apple"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("health_user_day_idx").on(t.userId, t.day)],
);

export const fastingSessions = pgTable(
  "fasting_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    targetHours: real("target_hours").notNull().default(16),
    note: text("note"),
  },
  (t) => [index("fast_user_start_idx").on(t.userId, t.startedAt)],
);

export const reportRuns = pgTable(
  "report_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull(),
    detail: text("detail"),
  },
  (t) => [uniqueIndex("report_user_day_idx").on(t.userId, t.day)],
);

/** A chat thread. Threads keep separate contexts so an old day's back and
 * forth does not leak into today's logging. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Taken from the first thing you said, editable later. */
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Bumped on every message so the list sorts by recent activity. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_user_updated_idx").on(t.userId, t.updatedAt)],
);

/**
 * The messages inside a thread. Every log starts as a user message; the
 * assistant reply records what was actually filed and where, so the thread
 * doubles as an audit trail you can scroll.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    /** user | assistant */
    role: text("role").notNull(),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    /** food | workout | weight | water | fast_start | fast_end | question | error */
    kind: text("kind"),
    /** Result cards: what got logged, with ids so rows can be undone. */
    payload: jsonb("payload").$type<ChatResultCard[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("message_user_time_idx").on(t.userId, t.createdAt),
    index("message_thread_idx").on(t.conversationId, t.createdAt),
  ],
);

export type ChatResultCard = {
  kind: "food" | "workout" | "weight" | "water" | "fast_start" | "fast_end";
  id: string | null;
  title: string;
  lines: string[];
  /** Small key/value chips shown under the title. */
  facts?: { label: string; value: string }[];
  sources?: { title: string; uri: string }[];
  /** A branded lookup was wanted but the search quota was spent. */
  unverified?: boolean;
};
