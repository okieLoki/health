import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { foodLogs } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { analyzeMeal } from "@/lib/gemini";
import { dayRange, timeInTz, todayKey } from "@/lib/dates";
import { putMealPhoto } from "@/lib/storage";
import { compressMealPhoto } from "@/lib/image";

export const runtime = "nodejs";
export const maxDuration = 60; // two Gemini hops can take a while

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    const day = new URL(req.url).searchParams.get("day") ?? todayKey(profile.timezone);
    const { start, end } = dayRange(day, profile.timezone);
    const rows = await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, user.id), gte(foodLogs.eatenAt, start), lte(foodLogs.eatenAt, end)))
      .orderBy(desc(foodLogs.eatenAt));
    return ok({ meals: rows });
  } catch (e) {
    return apiError(e);
  }
}

const manualSchema = z.object({
  name: z.string().min(1),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  eatenAt: z.string().datetime().optional(),
  calories: z.coerce.number().min(0),
  proteinG: z.coerce.number().min(0).default(0),
  carbsG: z.coerce.number().min(0).default(0),
  fatG: z.coerce.number().min(0).default(0),
  fiberG: z.coerce.number().min(0).optional(),
  sugarG: z.coerce.number().min(0).optional(),
  sodiumMg: z.coerce.number().min(0).optional(),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    const contentType = req.headers.get("content-type") ?? "";

    let text: string | undefined;
    let mealTypeHint: string | undefined;
    let eatenAtRaw: string | undefined;
    let image: { mimeType: string; data: string } | undefined;
    let compressed: Awaited<ReturnType<typeof compressMealPhoto>> | undefined;
    let manual: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = (form.get("text") as string) || undefined;
      mealTypeHint = (form.get("mealType") as string) || undefined;
      eatenAtRaw = (form.get("eatenAt") as string) || undefined;
      const file = form.get("photo");
      if (file instanceof File && file.size > 0) {
        if (!ALLOWED_IMAGE.has(file.type)) {
          return ok({ error: `Unsupported image type: ${file.type}` }, 415);
        }
        if (file.size > MAX_IMAGE_BYTES) {
          return ok({ error: "Photo is larger than 8 MB." }, 413);
        }
        // Shrink once, then use the same bytes for the model and the bucket.
        compressed = await compressMealPhoto(new Uint8Array(await file.arrayBuffer()), file.type);
        image = {
          mimeType: compressed.contentType,
          data: Buffer.from(compressed.bytes).toString("base64"),
        };
      }
    } else {
      const body = await req.json();
      if (body.manual) manual = body.manual;
      text = body.text;
      mealTypeHint = body.mealType;
      eatenAtRaw = body.eatenAt;
    }

    const eatenAt = eatenAtRaw ? new Date(eatenAtRaw) : new Date();
    if (Number.isNaN(eatenAt.getTime())) return ok({ error: "Invalid eatenAt" }, 400);

    // Manual path: the user typed exact numbers, so don't second-guess them.
    if (manual) {
      const m = manualSchema.parse(manual);
      const [row] = await db
        .insert(foodLogs)
        .values({
          userId: user.id,
          name: m.name,
          mealType: m.mealType,
          eatenAt: m.eatenAt ? new Date(m.eatenAt) : eatenAt,
          calories: m.calories,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          fiberG: m.fiberG,
          sugarG: m.sugarG,
          sodiumMg: m.sodiumMg,
          source: "manual",
        })
        .returning();
      return ok({ meal: row }, 201);
    }

    if (!text && !image) return ok({ error: "Describe the meal or attach a photo." }, 400);

    const analysis = await analyzeMeal({
      text,
      image,
      mealTypeHint,
      localTime: timeInTz(eatenAt, profile.timezone),
    });

    // Only spend a bucket write once the analysis succeeded.
    const imageUrl = compressed
      ? await putMealPhoto(user.id, compressed.bytes, compressed.contentType).catch(() => null)
      : null;

    const sourceNote = analysis.sources.length
      ? `${analysis.notes}\n\nSources: ${analysis.sources.map((s) => s.title).join(", ")}`
      : analysis.notes;

    const [row] = await db
      .insert(foodLogs)
      .values({
        userId: user.id,
        name: analysis.name,
        description: text ?? null,
        mealType: (mealTypeHint as string) || analysis.mealType,
        eatenAt,
        calories: analysis.totals.calories,
        proteinG: analysis.totals.proteinG,
        carbsG: analysis.totals.carbsG,
        fatG: analysis.totals.fatG,
        fiberG: analysis.totals.fiberG ?? null,
        sugarG: analysis.totals.sugarG ?? null,
        sodiumMg: analysis.totals.sodiumMg ?? null,
        items: analysis.items,
        source: image ? "photo" : "text",
        confidence: analysis.confidence,
        imageUrl,
        aiNotes: sourceNote,
      })
      .returning();

    return ok(
      {
        meal: row,
        sources: analysis.sources,
        ...(compressed
          ? { photo: { bytesBefore: compressed.bytesBefore, bytesAfter: compressed.bytesAfter } }
          : {}),
      },
      201,
    );
  } catch (e) {
    return apiError(e);
  }
}
