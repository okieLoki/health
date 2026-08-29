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

/* --------------------------------------------------------------------- chat */

const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("food"),
    occurredAt: z.string().nullish(),
    name: z.string().catch("Meal"),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).catch("snack"),
    items: z.array(itemSchema).catch([]),
    totals: totalsSchema,
    confidence: z.coerce.number().min(0).max(1).catch(0.5),
    notes: z.string().catch(""),
  }),
  z.object({
    kind: z.literal("workout"),
    occurredAt: z.string().nullish(),
    title: z.string().catch("Workout"),
    activity: z.enum(["gym", "walk", "run", "cardio", "sport", "other"]).catch("gym"),
    durationMin: optNum,
    caloriesBurned: optNum,
    distanceKm: optNum,
    exercises: z.array(exerciseSchema).catch([]),
    totalVolumeKg: optNum,
    notes: z.string().catch(""),
  }),
  z.object({
    kind: z.literal("weight"),
    occurredAt: z.string().nullish(),
    weightKg: z.coerce.number().min(20).max(400),
    bodyFatPct: optNum,
  }),
  z.object({
    kind: z.literal("water"),
    occurredAt: z.string().nullish(),
    amountMl: z.coerce.number().int().min(-5000).max(5000),
  }),
  z.object({ kind: z.literal("fast_start"), occurredAt: z.string().nullish(), targetHours: optNum }),
  z.object({ kind: z.literal("fast_end"), occurredAt: z.string().nullish() }),
]);

const chatSchema = z.object({
  reply: z.string().catch(""),
  needsLookup: z.coerce.boolean().catch(false),
  lookupQuery: z.string().nullish().catch(null),
  /** True when this message revises the previous one rather than adding to it. */
  correction: z.coerce.boolean().catch(false),
  actions: z.array(actionSchema).catch([]),
});

export type ChatAction = z.infer<typeof actionSchema>;
export type ChatInterpretation = {
  reply: string;
  actions: ChatAction[];
  sources: Source[];
  /** True when a lookup was wanted but the grounding quota was spent. */
  unverified: boolean;
  /** Replace what the previous turn logged instead of adding alongside it. */
  correction: boolean;
};

const CHAT_SYSTEM = `You are the logging brain of a weight-loss tracker. The user types one casual
message; work out what they are recording and extract it precisely.

A single message may contain SEVERAL things, "2 eggs for breakfast and walked 40 min" is a food
action AND a workout action. Emit one action per distinct thing.

WHAT COUNTS AS WHAT
- food    , anything eaten or drunk carrying calories (chai, beer, a protein shake all count).
- water   , plain water only. A glass is 250 ml, a bottle 1000 ml.
- weight  , a bodyweight reading: "82.4", "weighed 82.4 today", "82.4 kg 19% bf".
- workout , training, walking, running, sport, gym. Expand shorthand: "bench 4x8 60" is
             Bench Press, 4 sets of 8 reps at 60 kg. Convert lb to kg (1 lb = 0.4536 kg).
             Estimate calories burned from MET values for the user's bodyweight and duration.
             Bodyweight movements use the user's bodyweight as the load.
- fast_start / fast_end, "starting my fast now", "breaking my fast".
${NUTRITION_RULES}
${LOOKUP_RULE}

TIME
- You are given the user's current local time. Resolve relative phrasing against it:
  "for my dinner" late at night is today's dinner; "yesterday 9pm"; "this morning".
- occurredAt is the user's LOCAL wall-clock time as "YYYY-MM-DDTHH:mm". Null means now.
- If they name a meal ("for my dinner") take mealType from that, not from the clock.

USING THE CONVERSATION
- You are given the earlier turns and today's running totals. Use them.
- A follow-up refers to the message before it. When they REVISE what they just logged
  ("actually make that 3", "no it was 2 slices", "that was dinner not lunch"), set
  "correction": true and emit the FULL corrected action. The old entry is replaced, so state
  the complete corrected amount, never just the difference.
  Set "correction": false when they are logging something additional.
- If they are ASKING something rather than logging ("how many calories left?", "how much
  protein so far?", "am I on track?"), answer it from the numbers you were given and return
  ZERO actions. Be specific and quote the actual figure.
- Never re-log something that is already in TODAY SO FAR unless they clearly ate it again.

REPLY
- One short, warm, human sentence confirming what you logged, with the key number in it.
  "Logged your Maggi dinner, 512 kcal and 11 g protein." No markdown, no emoji, never preachy.
  NEVER use em dashes or en dashes in any text you write. Use commas, full stops or brackets.
- If you truly cannot tell what they meant, return zero actions and ask one clarifying question.`;

const CHAT_JSON = `Output JSON only:
{"reply":string,"needsLookup":boolean,"lookupQuery":string|null,"correction":boolean,"actions":[
 {"kind":"food","occurredAt":string|null,"name":string,"mealType":"breakfast"|"lunch"|"dinner"|"snack",
  "items":[{"name":string,"quantity":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,
            "fiberG":number|null,"sugarG":number|null,"sodiumMg":number|null}],
  "totals":{"calories":number,"proteinG":number,"carbsG":number,"fatG":number,
            "fiberG":number|null,"sugarG":number|null,"sodiumMg":number|null},
  "confidence":number,"notes":string}
|{"kind":"workout","occurredAt":string|null,"title":string,
  "activity":"gym"|"walk"|"run"|"cardio"|"sport"|"other","durationMin":number|null,
  "caloriesBurned":number|null,"distanceKm":number|null,
  "exercises":[{"name":string,"sets":[{"reps":number|null,"weightKg":number|null,"distanceKm":number|null,
                "durationMin":number|null}]|null,"volumeKg":number|null,"notes":string|null}],
  "totalVolumeKg":number|null,"notes":string}
|{"kind":"weight","occurredAt":string|null,"weightKg":number,"bodyFatPct":number|null}
|{"kind":"water","occurredAt":string|null,"amountMl":number}
|{"kind":"fast_start","occurredAt":string|null,"targetHours":number|null}
|{"kind":"fast_end","occurredAt":string|null}]}
Nutrients are grams except calories (kcal) and sodiumMg (mg). "totals" equals the sum of "items".`;

/** The single call the chat box makes. */
export async function interpret(input: {
  text?: string;
  image?: { mimeType: string; data: string };
  localNow: string;
  timezone: string;
  bodyWeightKg?: number | null;
  /** Recent turns, oldest first, so follow-ups and corrections make sense. */
  history?: { role: string; text: string }[];
  /** Today's running totals, so questions can be answered from real numbers. */
  dayContext?: string;
}): Promise<ChatInterpretation> {
  const turns = (input.history ?? [])
    .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.text}`)
    .join("\n");

  const context = [
    `User's local time right now: ${input.localNow} (${input.timezone}).`,
    input.bodyWeightKg ? `User's bodyweight: ${input.bodyWeightKg} kg.` : "",
    input.dayContext ? `\nTODAY SO FAR\n${input.dayContext}` : "",
    turns ? `\nEARLIER IN THIS CONVERSATION\n${turns}` : "",
    "\nTHE NEW MESSAGE",
    input.image ? "They attached this photo." : "",
    input.text ? `They wrote: "${input.text}"` : "They sent only a photo.",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: input.image });
  parts.push({ text: `${context}\n\n${CHAT_JSON}` });

  // Pass 1, ungrounded, always runs. Groq handles it unless a photo is
  // attached, in which case only Gemini can see the image.
  const first =
    (!input.image && groqReady()
      ? await groqJson(CHAT_SYSTEM, `${context}\n\n${CHAT_JSON}`)
      : null) ?? (await must({ system: CHAT_SYSTEM, parts, json: true, temperature: 0.2 }));
  let parsed = chatSchema.parse(extractJson(first.text));
  let sources: Source[] = [];
  let unverified = false;

  // Pass 2, only for branded items, and only if the grounding quota allows.
  if (parsed.needsLookup && parsed.lookupQuery) {
    const facts = await groundedFacts(parsed.lookupQuery);
    if (facts) {
      sources = facts.sources;
      const refined = await generate({
        system: `Revise the JSON using the official nutrition facts provided. Keep the same
structure, actions and occurredAt. Update only the food numbers that the facts contradict,
scaling to the portion the user actually ate. Raise confidence. Output JSON only.`,
        parts: [
          { text: `Official facts:\n${facts.text}\n\nCurrent JSON:\n${JSON.stringify(parsed)}\n\n${CHAT_JSON}` },
        ],
        json: true,
        temperature: 0,
        optional: true,
      });
      if (refined) {
        try {
          parsed = chatSchema.parse(extractJson(refined.text));
        } catch {
          /* keep pass-1 numbers */
        }
      }
    } else {
      unverified = true;
    }
  }

  for (const a of parsed.actions) {
    if (a.kind === "food") reconcileTotals(a.items, a.totals);
    if (a.kind === "workout" && a.totalVolumeKg == null && a.exercises.length) {
      const vol = a.exercises.reduce(
        (t, ex) =>
          t +
          (ex.volumeKg ??
            (ex.sets ?? []).reduce((s, st) => s + (st.reps ?? 0) * (st.weightKg ?? 0), 0)),
        0,
      );
      a.totalVolumeKg = vol > 0 ? round(vol) : null;
    }
  }

  return { reply: parsed.reply, actions: parsed.actions, sources, unverified, correction: parsed.correction };
}

/**
 * Groq cannot see, so a photo is turned into prose here and the agent reasons
 * over that description exactly as it would over typed words.
 */
export async function describePhoto(image: { mimeType: string; data: string }, note?: string) {
  const res = await generate({
    system: `You describe a photo of food for a nutrition tracker. Name every distinct item and
estimate its portion using the plate, cutlery and any hand as scale. Note the cooking method and
any visible oil or sauce. If a branded package or a restaurant is visible, say the brand by name.
Be concrete and brief. Do not give calories. Plain text only, never use em dashes.`,
    parts: [
      { inlineData: image },
      { text: note ? `The user also wrote: "${note}"` : "Describe what is on the plate." },
    ],
    temperature: 0.2,
    optional: true,
  });
  return res?.text.trim() ?? null;
}

/* ------------------------------------------- single-purpose entry points */

const mealOnlySchema = z.object({
  name: z.string().min(1).catch("Meal"),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).catch("snack"),
  items: z.array(itemSchema).catch([]),
  totals: totalsSchema,
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  notes: z.string().catch(""),
  needsLookup: z.coerce.boolean().catch(false),
  lookupQuery: z.string().nullish().catch(null),
});

export type MealAnalysis = z.infer<typeof mealOnlySchema> & { sources: Source[] };

const MEAL_JSON = `Output JSON only:
{"name":string,"mealType":"breakfast"|"lunch"|"dinner"|"snack","needsLookup":boolean,
 "lookupQuery":string|null,
 "items":[{"name":string,"quantity":string,"calories":number,"proteinG":number,"carbsG":number,
           "fatG":number,"fiberG":number|null,"sugarG":number|null,"sodiumMg":number|null}],
 "totals":{"calories":number,"proteinG":number,"carbsG":number,"fatG":number,
           "fiberG":number|null,"sugarG":number|null,"sodiumMg":number|null},
 "confidence":number,
 "notes":string, assumptions made, plus one blunt line on how this fits a calorie deficit}`;

export async function analyzeMeal(input: {
  text?: string;
  image?: { mimeType: string; data: string };
  mealTypeHint?: string;
  localTime?: string;
}): Promise<MealAnalysis> {
  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: input.image });
  parts.push({
    text: [
      input.image ? "Analyse the food in this photo." : "Analyse this meal.",
      input.text ? `Logged as: "${input.text}"` : "",
      input.localTime ? `Eaten at ${input.localTime} local time.` : "",
      input.mealTypeHint ? `Tagged as ${input.mealTypeHint}.` : "",
      "",
      MEAL_JSON,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const first = await must({
    system: `You are a precise nutrition analyst.${NUTRITION_RULES}${LOOKUP_RULE}`,
    parts,
    json: true,
    temperature: 0.2,
  });
  let parsed = mealOnlySchema.parse(extractJson(first.text));
  let sources: Source[] = [];

  if (parsed.needsLookup && parsed.lookupQuery) {
    const facts = await groundedFacts(parsed.lookupQuery);
    if (facts) {
      sources = facts.sources;
      const refined = await generate({
        system: `Revise the JSON using these official nutrition facts, scaled to the portion
eaten. Same structure. Output JSON only.`,
        parts: [{ text: `Facts:\n${facts.text}\n\nJSON:\n${JSON.stringify(parsed)}\n\n${MEAL_JSON}` }],
        json: true,
        temperature: 0,
        optional: true,
      });
      if (refined) {
        try {
          parsed = mealOnlySchema.parse(extractJson(refined.text));
        } catch {
          /* keep first-pass numbers */
        }
      }
    }
  }

  reconcileTotals(parsed.items, parsed.totals);
  return { ...parsed, sources };
}

const workoutOnlySchema = z.object({
  title: z.string().min(1).catch("Workout"),
  kind: z.enum(["gym", "walk", "run", "cardio", "sport", "other"]).catch("gym"),
  durationMin: optNum,
  caloriesBurned: optNum,
  distanceKm: optNum,
  exercises: z.array(exerciseSchema).catch([]),
  totalVolumeKg: optNum,
  notes: z.string().catch(""),
});

export type WorkoutAnalysis = z.infer<typeof workoutOnlySchema> & { sources: Source[] };

export async function analyzeWorkout(input: {
  text: string;
  bodyWeightKg?: number | null;
  localTime?: string;
}): Promise<WorkoutAnalysis> {
  const json = `Output JSON only:
{"title":string,"kind":"gym"|"walk"|"run"|"cardio"|"sport"|"other","durationMin":number|null,
 "caloriesBurned":number|null,"distanceKm":number|null,
 "exercises":[{"name":string,"sets":[{"reps":number|null,"weightKg":number|null,
               "distanceKm":number|null,"durationMin":number|null}]|null,
               "volumeKg":number|null,"notes":string|null}],
 "totalVolumeKg":number|null,"notes":string, one or two sentences of coaching feedback}`;

  const result = await must({
    system: `You are a strength and conditioning coach parsing a training log.
- Expand shorthand: "bench 4x8 60" is Bench Press, 4 sets of 8 reps at 60 kg.
- Normalise exercise names. Weights in kg; convert lb (1 lb = 0.4536 kg) and say so.
- Estimate calories burned from MET values for the given bodyweight and duration.
- Bodyweight movements use the user's bodyweight as the load.
- Never refuse. Estimate whatever is missing.`,
    parts: [
      {
        text: [
          `Parse this session: "${input.text}"`,
          input.bodyWeightKg ? `Athlete bodyweight: ${input.bodyWeightKg} kg.` : "",
          input.localTime ? `Performed around ${input.localTime} local time.` : "",
          "",
          json,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    json: true,
    temperature: 0.2,
  });

  const parsed = workoutOnlySchema.parse(extractJson(result.text));
  if (parsed.totalVolumeKg == null && parsed.exercises.length) {
    const vol = parsed.exercises.reduce(
      (t, ex) =>
        t + (ex.volumeKg ?? (ex.sets ?? []).reduce((s, st) => s + (st.reps ?? 0) * (st.weightKg ?? 0), 0)),
      0,
    );
    parsed.totalVolumeKg = vol > 0 ? round(vol) : null;
  }
  return { ...parsed, sources: [] };
}

/** Short paragraph for the daily email. Never blocks the report. */
export async function coachNote(summary: string): Promise<string | null> {
  const res = await generate({
    system: `You write the one-paragraph coach's note at the end of a daily weight-loss report.
Be specific and numeric, reference the actual numbers given. Direct and warm, never preachy,
never a disclaimer. Name the single highest-leverage thing to do tomorrow. 3 sentences maximum.
Plain text only. Never use em dashes or en dashes; use commas or full stops.`,
    parts: [{ text: summary }],
    temperature: 0.6,
    optional: true,
  });
  return res?.text.trim() ?? null;
}

export const geminiConfigured = () => Boolean(process.env.GOOGLE_API_KEY);
export const groqConfigured = groqReady;
export const geminiModel = () => MODEL;
