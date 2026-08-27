import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ profile: await getProfile(user.id) });
  } catch (e) {
    return apiError(e);
  }
}

const nullableNum = (min: number, max: number) =>
  z.coerce.number().min(min).max(max).nullable().optional();

const schema = z.object({
  heightCm: nullableNum(80, 260),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  targetWeightKg: nullableNum(20, 400),
  weeklyRateKg: z.coerce.number().min(0).max(1.5).optional(),
  timezone: z.string().min(1).max(64).optional(),
  waterTargetMl: z.coerce.number().int().min(500).max(10000).optional(),
  stepTarget: z.coerce.number().int().min(1000).max(50000).optional(),
  fastingTargetHours: z.coerce.number().min(8).max(36).optional(),
  calorieTargetOverride: z.coerce.number().int().min(800).max(6000).nullable().optional(),
  proteinTargetG: z.coerce.number().int().min(0).max(500).nullable().optional(),
  carbTargetG: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  fatTargetG: z.coerce.number().int().min(0).max(400).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const patch = schema.parse(await req.json());

    // Validate the timezone before storing it, getTrend interpolates it into SQL.
    if (patch.timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: patch.timezone });
      } catch {
        return ok({ error: `Unknown timezone: ${patch.timezone}` }, 400);
      }
    }

    await getProfile(user.id);
    const [row] = await db
      .update(profiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(profiles.userId, user.id))
      .returning();
    return ok({ profile: row });
  } catch (e) {
    return apiError(e);
  }
}
