import { z } from "zod";
import { webSearch } from "./search";

/**
 * Google Gemini on the free AI Studio tier.
 *
 * The important constraint: ordinary generateContent calls are plentiful, but
 * *Google Search grounding* has its own small daily quota. So the shape here is
 *   pass 1, one ungrounded structured call that extracts everything and says
 *            whether an official nutrition lookup would actually change the answer
 *   pass 2, only for branded/restaurant items, one grounded call to check it
 * and pass 2 is always allowed to fail: a spent quota degrades the estimate,
 * it never fails the log.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const SEARCH_ENABLED = process.env.GEMINI_SEARCH !== "off";

/**
 * Groq runs the plain-text extraction: it is roughly five times faster than
 * Gemini here and its free tier is far more generous. Gemini is kept for the
 * two things Groq cannot do, reading a photo and searching the web.
 */
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const groqReady = () => Boolean(process.env.GROQ_API_KEY);

async function groqJson(system: string, user: string): Promise<GenerateResult | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? { text, sources: [] } : null;
  } catch {
    return null;
  }
}

export class GeminiError extends Error {}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type Source = { title: string; uri: string };
type GenerateResult = { text: string; sources: Source[] };

type GenerateOptions = {
  system?: string;
  parts: Part[];
  search?: boolean;
  json?: boolean;
  temperature?: number;
  /** Return null instead of throwing when the quota is spent. */
  optional?: boolean;
};

async function generate(opts: GenerateOptions, attempt = 0): Promise<GenerateResult | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    if (opts.optional) return null;
    throw new GeminiError(
      "GOOGLE_API_KEY is not set. Grab a free key at aistudio.google.com/apikey.",
    );
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.search && SEARCH_ENABLED) body.tools = [{ google_search: {} }];

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    if (opts.optional) return null;
    throw new GeminiError(err instanceof Error ? err.message : "Could not reach Gemini");
  }

  if (res.status === 429) {
    if (opts.optional) return null; // grounding quota spent, carry on unverified
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, [6000, 18000][attempt] + Math.random() * 2000));
      return generate(opts, attempt + 1);
    }
    throw new GeminiError("Gemini is rate-limiting this key. Give it a moment and try again.");
  }
  if (!res.ok) {
    if (opts.optional) return null;
    throw new GeminiError(`Gemini ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    if (opts.optional) return null;
    throw new GeminiError("Gemini returned an empty response.");
  }

  const sources: Source[] = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { title?: string; uri?: string } }) => c.web)
    .filter((w: { uri?: string } | undefined): w is Source => Boolean(w?.uri))
    .map((w: { title?: string; uri: string }) => ({ title: w.title ?? w.uri, uri: w.uri }));

  return { text, sources };
}

async function must(opts: GenerateOptions): Promise<GenerateResult> {
  const res = await generate(opts);
  if (!res) throw new GeminiError("Gemini returned nothing.");
  return res;
}

/** Models sometimes wrap JSON in prose or a fence even when told not to. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) throw new GeminiError("Could not parse JSON from the model.");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

const num = z.coerce.number().finite().catch(0);
const optNum = z.coerce.number().finite().nullish().catch(null);

const itemSchema = z.object({
  name: z.string().catch("Item"),
  quantity: z.string().catch(""),
  calories: num,
  proteinG: num,
  carbsG: num,
  fatG: num,
  fiberG: optNum,
  sugarG: optNum,
  sodiumMg: optNum,
});

const totalsSchema = z.object({
  calories: num,
  proteinG: num,
  carbsG: num,
  fatG: num,
  fiberG: optNum,
  sugarG: optNum,
  sodiumMg: optNum,
});

/**
 * Prefer the itemised sum over a separately-stated total, but per-field and
 * only where the items carry that nutrient, a model that itemises calories
 * while omitting carbs must not zero out a correct stated total.
 */
function reconcileTotals(
  items: z.infer<typeof itemSchema>[],
  totals: z.infer<typeof totalsSchema>,
) {
  if (!items.length) return;
  for (const field of ["calories", "proteinG", "carbsG", "fatG"] as const) {
    const sum = items.reduce((a, i) => a + (i[field] ?? 0), 0);
    if (sum > 0) totals[field] = round(sum);
  }
}

const exerciseSchema = z.object({
  name: z.string().catch("Exercise"),
  sets: z
    .array(z.object({ reps: optNum, weightKg: optNum, distanceKm: optNum, durationMin: optNum }))
    .nullish()
    .catch(null),
  volumeKg: optNum,
  notes: z.string().nullish().catch(null),
});

/* ------------------------------------------------------------ nutrition rules */

const NUTRITION_RULES = `
- Identify every distinct food and drink with a realistic portion.
- EVERY item carries calories, proteinG, carbsG AND fatG. Never leave a macro at 0 unless the
  food truly has none, instant noodles are mostly carbs and fat, not 0 g of each.
- Scale to the stated quantity: "1.5 packets" is 1.5x the per-pack numbers.
- Indian home cooking: assume normal ghee/oil unless told otherwise. Use IFCT/USDA references.
- Estimate photo portions from plate size, hand and cutlery.
- "name" describes the FOOD, never the meal slot. "Maggi with cheese", "Eggs and black
  coffee". Never "Breakfast", "Lunch", "Dinner" or "Snack" as the name.
- Never refuse and never ask a clarifying question. Estimate, and lower confidence instead.`;

const LOOKUP_RULE = `
- Set needsLookup true ONLY when the item is a specific branded, packaged or restaurant product
  whose official published figures would meaningfully change the answer (Maggi, Amul, a named
  protein bar, "McSpicy from McDonald's"). Put a precise search phrase in lookupQuery.
  Generic or home-cooked food never needs a lookup.`;

/* ---------------------------------------------------------------- grounding */

/**
 * One lookup for a branded item. Parallel first because it is free and
 * unmetered; Gemini grounding only if that fails and its quota still allows.
 * Either way a failure returns null and the caller keeps its own estimate.
 */
async function groundedFacts(query: string): Promise<GenerateResult | null> {
  const viaParallel = await webSearch(
    `Official published nutrition facts for ${query}: serving size, calories, protein, carbohydrate, fat, fibre, sugar and sodium.`,
    [query, `${query} nutrition facts calories protein carbs fat`],
  );
  if (viaParallel) return viaParallel;

  return generate({
    system: `You look up official nutrition facts. Search, then state the figures plainly:
serving size, calories, protein, carbohydrate, fat, fibre, sugar and sodium, and whose
numbers they are. If you cannot find official figures, say so in one line.`,
    parts: [{ text: query }],
    search: true,
    optional: true,
    temperature: 0,
  });
}
