import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { healthDays, profiles, weightLogs } from "@/db/schema";
import { apiError, ok } from "@/lib/api";
import { todayKey } from "@/lib/dates";

export const runtime = "nodejs";

/**
 * Apple gives no server-side Health API, so the phone pushes to us.
 * An iOS Shortcuts automation POSTs this shape once or twice a day.
 * Authenticated by the per-user ingest token, not a session cookie.
 *
 * Shortcuts sends most numbers as strings, hence the coercion everywhere.
 */
const num = z.coerce.number().finite().nullish();

const schema = z.object({
  token: z.string().min(8).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  steps: num,
  activeEnergy: num,
  basalEnergy: num,
  exerciseMinutes: num,
  standHours: num,
  distanceKm: num,
  flightsClimbed: num,
  restingHR: num,
  avgHR: num,
  sleepMinutes: num,
  /** Optional, the Watch/scale weight, recorded as a weight entry too. */
  weightKg: num,
});

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return null;
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const body = schema.parse(raw);
    const token = bearer(req) ?? body.token;
    if (!token) return ok({ error: "Missing ingest token" }, 401);

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.ingestToken, token),
    });
    if (!profile) return ok({ error: "Unknown ingest token" }, 401);

    const day = body.day ?? todayKey(profile.timezone);

    const values = {
      steps: body.steps != null ? Math.round(body.steps) : null,
      activeEnergyKcal: body.activeEnergy ?? null,
      basalEnergyKcal: body.basalEnergy ?? null,
      exerciseMin: body.exerciseMinutes ?? null,
      standHours: body.standHours != null ? Math.round(body.standHours) : null,
      distanceKm: body.distanceKm ?? null,
      flightsClimbed: body.flightsClimbed != null ? Math.round(body.flightsClimbed) : null,
      restingHr: body.restingHR ?? null,
      avgHr: body.avgHR ?? null,
      sleepMin: body.sleepMinutes ?? null,
      updatedAt: new Date(),
    };

    // Don't let a field the Shortcut didn't send wipe a value we already have.
    const set = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== null || false),
    ) as typeof values;

    const [row] = await db
      .insert(healthDays)
      .values({ userId: profile.userId, day, source: "apple", ...values })
      .onConflictDoUpdate({
        target: [healthDays.userId, healthDays.day],
        set: { ...set, updatedAt: new Date() },
      })
      .returning();

    if (body.weightKg && body.weightKg > 20) {
      await db.insert(weightLogs).values({
        userId: profile.userId,
        weightKg: body.weightKg,
        source: "apple",
        measuredAt: new Date(),
      });
    }

    return ok({ saved: { day: row.day, steps: row.steps, activeEnergy: row.activeEnergyKcal } }, 201);
  } catch (e) {
    return apiError(e);
  }
}
