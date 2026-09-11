import { tool } from "@langchain/core/tools";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  fastingSessions,
  foodLogs,
  waterLogs,
  weightLogs,
  workouts,
  type ChatResultCard,
} from "@/db/schema";
import { localToUtc, timeInTz } from "@/lib/dates";
import { webSearch } from "@/lib/search";
import { getDaySummary } from "@/lib/stats";
import type { Profile } from "@/lib/auth";

export type ToolContext = {
  userId: string;
  profile: Profile;
  imageUrl: string | null;
  /** Filled as the agent works, rendered as result cards in the thread. */
  cards: ChatResultCard[];
};

const round = (n: number) => Math.round(n * 10) / 10;

// Note: .optional() not .nullish(), so the schema stays portable across providers.
const itemSchema = z.object({
  name: z.string(),
  quantity: z.string().describe("Portion eaten, e.g. '2 pieces'"),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number().optional(),
  sugarG: z.number().optional(),
  sodiumMg: z.number().optional(),
});

const OCCURRED = "Local time YYYY-MM-DDTHH:mm. Omit for now.";

export function buildTools(ctx: ToolContext) {
  const tz = ctx.profile.timezone;
  const at = (occurredAt?: string | null) =>
    (occurredAt && localToUtc(occurredAt, tz)) || new Date();

  const searchNutrition = tool(
    async ({ query }) => {
      const found = await webSearch(
        `Official published nutrition facts for ${query}: serving size, calories, protein, carbohydrate, fat, fibre, sugar and sodium.`,
        [query, `${query} nutrition facts calories protein carbs fat`],
      );
      if (!found) return "No results. Use your own knowledge and lower the confidence.";
      return found.text.slice(0, 6000);
    },
    {
      name: "search_nutrition",
      description:
        "Web lookup of official nutrition facts. Branded or restaurant items only (Maggi, Amul, McDonald's). Never for home-cooked food.",
      schema: z.object({ query: z.string() }),
    },
  );

  const getToday = tool(
    async () => {
      const day = await getDaySummary(ctx.userId);
      const t = day.targets;
      return [
        `Eaten ${Math.round(day.totals.calories)} kcal.`,
        t.calories
          ? `Target ${t.calories} kcal, remaining ${Math.round(t.calories - day.totals.calories)} kcal.`
          : "NO CALORIE TARGET IS SET YET. Say the profile needs finishing rather than quoting a number.",
        `Protein ${Math.round(day.totals.proteinG)}g, carbs ${Math.round(day.totals.carbsG)}g, fat ${Math.round(day.totals.fatG)}g.`,
        `Water ${day.waterMl}ml of ${day.profile.waterTargetMl}ml. Steps ${day.health?.steps ?? 0}.`,
        day.latestWeight ? `Weight ${day.latestWeight.weightKg}kg.` : "No weight logged.",
        day.meals.length
          ? `Meals: ${day.meals.map((m) => `${m.name} ${Math.round(m.calories)}kcal at ${timeInTz(m.eatenAt, tz)}`).join("; ")}.`
          : "No meals yet.",
        day.workouts.length ? `Training: ${day.workouts.map((w) => w.title).join("; ")}.` : "No training yet.",
        `Fasted ${day.fasting.hours?.toFixed(1) ?? 0}h of ${day.fasting.targetHours}h target.`,
      ]
        .filter(Boolean)
        .join("\n");
    },
    {
      name: "get_today",
      description: "Today's totals, targets and everything already logged. Call before answering any question about progress.",
      schema: z.object({}),
    },
  );

  const logFood = tool(
    async ({ name, mealType, items, occurredAt, notes, confidence }) => {
      const totals = items.reduce(
        (a, i) => ({
          calories: a.calories + i.calories,
          proteinG: a.proteinG + i.proteinG,
          carbsG: a.carbsG + i.carbsG,
          fatG: a.fatG + i.fatG,
          fiberG: a.fiberG + (i.fiberG ?? 0),
          sugarG: a.sugarG + (i.sugarG ?? 0),
          sodiumMg: a.sodiumMg + (i.sodiumMg ?? 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
      );

      const [row] = await db
        .insert(foodLogs)
        .values({
          userId: ctx.userId,
          name,
          mealType,
          eatenAt: at(occurredAt),
          calories: round(totals.calories),
          proteinG: round(totals.proteinG),
          carbsG: round(totals.carbsG),
          fatG: round(totals.fatG),
          fiberG: totals.fiberG || null,
          sugarG: totals.sugarG || null,
          sodiumMg: totals.sodiumMg || null,
          items,
          source: ctx.imageUrl ? "photo" : "chat",
          confidence: confidence ?? 0.7,
          imageUrl: ctx.imageUrl,
          aiNotes: notes ?? null,
        })
        .returning();

      ctx.cards.push({
        kind: "food",
        id: row.id,
        title: row.name,
        lines: items.map((i) => `${i.name}${i.quantity ? ` · ${i.quantity}` : ""}, ${Math.round(i.calories)} kcal`),
        facts: [
          { label: "Calories", value: `${Math.round(row.calories)}` },
          { label: "Protein", value: `${Math.round(row.proteinG)} g` },
          { label: "Carbs", value: `${Math.round(row.carbsG)} g` },
          { label: "Fat", value: `${Math.round(row.fatG)} g` },
        ],
      });

      return `Logged ${row.name}: ${Math.round(row.calories)} kcal, ${Math.round(row.proteinG)}g protein.`;
    },
    {
      name: "log_food",
      description:
        "Record food or a caloric drink. Itemise it. Every item needs calories, proteinG, carbsG and fatG, all non-zero unless the food truly lacks that macro.",
      schema: z.object({
        name: z.string().describe("The food itself, never the meal slot"),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        items: z.array(itemSchema).min(1),
        occurredAt: z.string().optional().describe(OCCURRED),
        notes: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    },
  );

  const logWorkout = tool(
    async ({ title, kind, occurredAt, durationMin, caloriesBurned, distanceKm, exercises, notes }) => {
      const volume = (exercises ?? []).reduce(
        (t, ex) => t + (ex.sets ?? []).reduce((s, st) => s + (st.reps ?? 0) * (st.weightKg ?? 0), 0),
        0,
      );
      const [row] = await db
        .insert(workouts)
        .values({
          userId: ctx.userId,
          kind,
          title,
          performedAt: at(occurredAt),
          durationMin: durationMin ?? null,
          caloriesBurned: caloriesBurned ?? null,
          distanceKm: distanceKm ?? null,
          exercises: exercises ?? [],
          totalVolumeKg: volume > 0 ? round(volume) : null,
          source: "chat",
          aiNotes: notes ?? null,
        })
        .returning();

      ctx.cards.push({
        kind: "workout",
        id: row.id,
        title: row.title,
        lines: (exercises ?? []).map((ex) => {
          const sets = (ex.sets ?? [])
            .map((s) =>
              s.reps && s.weightKg ? `${s.reps}×${s.weightKg}kg`
              : s.reps ? `${s.reps} reps`
              : s.distanceKm ? `${s.distanceKm} km`
              : s.durationMin ? `${s.durationMin} min` : "",
            )
            .filter(Boolean)
            .join(", ");
          return sets ? `${ex.name}, ${sets}` : ex.name;
        }),
        facts: [
          ...(row.durationMin ? [{ label: "Duration", value: `${Math.round(row.durationMin)} min` }] : []),
          ...(row.caloriesBurned ? [{ label: "Burned", value: `${Math.round(row.caloriesBurned)} kcal` }] : []),
          ...(row.totalVolumeKg ? [{ label: "Volume", value: `${Math.round(row.totalVolumeKg)} kg` }] : []),
        ],
      });

      return `Logged ${row.title}.`;
    },
    {
      name: "log_workout",
      description:
        "Record training. Expand shorthand: 'bench 4x8 60' is 4 sets of 8 reps at 60kg. Convert lb to kg. Estimate calories from MET values and bodyweight.",
      schema: z.object({
        title: z.string().describe("Short label, e.g. 'Push day'"),
        kind: z.enum(["gym", "walk", "run", "cardio", "sport", "other"]),
        occurredAt: z.string().optional().describe(OCCURRED),
        durationMin: z.number().optional(),
        caloriesBurned: z.number().optional(),
        distanceKm: z.number().optional(),
        exercises: z
          .array(
            z.object({
              name: z.string(),
              sets: z
                .array(
                  z.object({
                    reps: z.number().optional(),
                    weightKg: z.number().optional(),
                    distanceKm: z.number().optional(),
                    durationMin: z.number().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
        notes: z.string().optional(),
      }),
    },
  );

  const logWeight = tool(
    async ({ weightKg, bodyFatPct, occurredAt }) => {
      const when = at(occurredAt);
      const [row] = await db
        .insert(weightLogs)
        .values({ userId: ctx.userId, weightKg, bodyFatPct: bodyFatPct ?? null, measuredAt: when, source: "chat" })
        .returning();
      ctx.cards.push({
        kind: "weight",
        id: row.id,
        title: `${row.weightKg.toFixed(1)} kg`,
        lines: [],
        facts: [
          { label: "Logged", value: timeInTz(when, tz) },
          ...(row.bodyFatPct ? [{ label: "Body fat", value: `${row.bodyFatPct}%` }] : []),
        ],
      });
      return `Logged ${row.weightKg} kg.`;
    },
    {
      name: "log_weight",
      description: "Record a bodyweight reading in kg.",
      schema: z.object({
        weightKg: z.number().min(20).max(400),
        bodyFatPct: z.number().min(1).max(70).optional(),
        occurredAt: z.string().optional().describe(OCCURRED),
      }),
    },
  );

  const logWater = tool(
    async ({ amountMl, occurredAt }) => {
      const when = at(occurredAt);
      const [row] = await db
        .insert(waterLogs)
        .values({ userId: ctx.userId, amountMl: Math.round(amountMl), loggedAt: when })
        .returning();
      ctx.cards.push({
        kind: "water",
        id: row.id,
        title: `${row.amountMl} ml`,
        lines: [],
        facts: [{ label: "Logged", value: timeInTz(when, tz) }],
      });
      return `Logged ${row.amountMl} ml of water.`;
    },
    {
      name: "log_water",
      description: "Record plain water. Glass 250ml, bottle 1000ml.",
      schema: z.object({
        amountMl: z.number().min(1).max(5000),
        occurredAt: z.string().optional().describe(OCCURRED),
      }),
    },
  );

  const startFast = tool(
    async ({ targetHours, occurredAt }) => {
      const when = at(occurredAt);
      await db
        .update(fastingSessions)
        .set({ endedAt: new Date() })
        .where(and(eq(fastingSessions.userId, ctx.userId), isNull(fastingSessions.endedAt)));
      const [row] = await db
        .insert(fastingSessions)
        .values({
          userId: ctx.userId,
          startedAt: when,
          targetHours: targetHours ?? ctx.profile.fastingTargetHours,
        })
        .returning();
      ctx.cards.push({
        kind: "fast_start",
        id: row.id,
        title: "Fast started",
        lines: [],
        facts: [
          { label: "From", value: timeInTz(when, tz) },
          { label: "Target", value: `${Math.round(row.targetHours)} h` },
        ],
      });
      return `Fast started, target ${Math.round(row.targetHours)} hours.`;
    },
    {
      name: "start_fast",
      description: "Begin an explicit fast. Overnight fasting is tracked automatically, so only use this if asked.",
      schema: z.object({
        targetHours: z.number().min(1).max(168).optional(),
        occurredAt: z.string().optional().describe(OCCURRED),
      }),
    },
  );

  const endFast = tool(
    async ({ occurredAt }) => {
      const when = at(occurredAt);
      const [row] = await db
        .update(fastingSessions)
        .set({ endedAt: when })
        .where(and(eq(fastingSessions.userId, ctx.userId), isNull(fastingSessions.endedAt)))
        .returning();
      if (!row) return "No fast was running.";
      const h = (when.getTime() - row.startedAt.getTime()) / 3_600_000;
      ctx.cards.push({
        kind: "fast_end",
        id: row.id,
        title: `Fast ended, ${h.toFixed(1)} h`,
        lines: [],
        facts: [{ label: "Target", value: `${Math.round(row.targetHours)} h` }],
      });
      return `Fast ended after ${h.toFixed(1)} hours.`;
    },
    {
      name: "end_fast",
      description: "Close the running fast.",
      schema: z.object({ occurredAt: z.string().optional().describe(OCCURRED) }),
    },
  );

  const undoLast = tool(
    async ({ kind }) => {
      const table = { food: foodLogs, workout: workouts, weight: weightLogs, water: waterLogs }[kind];
      const order = {
        food: desc(foodLogs.eatenAt),
        workout: desc(workouts.performedAt),
        weight: desc(weightLogs.measuredAt),
        water: desc(waterLogs.loggedAt),
      }[kind];

      const latest = await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.userId, ctx.userId))
        .orderBy(order)
        .limit(1);
      if (!latest.length) return `Nothing of that kind to remove.`;

      await db.delete(table).where(and(eq(table.id, latest[0].id), eq(table.userId, ctx.userId)));
      return `Removed the most recent ${kind} entry.`;
    },
    {
      name: "undo_last",
      description: "Delete the most recent entry of a kind. For corrections: undo_last, then log the corrected version.",
      schema: z.object({ kind: z.enum(["food", "workout", "weight", "water"]) }),
    },
  );

  return [searchNutrition, getToday, logFood, logWorkout, logWeight, logWater, startFast, endFast, undoLast];
}
