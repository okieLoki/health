import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { runAgent } from "@/lib/agent";
import { describePhoto } from "@/lib/gemini";
import { localContext } from "@/lib/dates";
import { compressMealPhoto } from "@/lib/image";
import { putMealPhoto } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 40), 200);
    const conversationId = params.get("conversationId");
    const rows = await db
      .select()
      .from(messages)
      .where(
        conversationId
          ? and(eq(messages.userId, user.id), eq(messages.conversationId, conversationId))
          : eq(messages.userId, user.id),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return ok({ messages: rows.reverse() });
  } catch (e) {
    return apiError(e);
  }
}

/** The thread named, else the most recent, else a fresh one. */
async function resolveThread(userId: string, requested?: string | null) {
  if (requested) {
    const found = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, requested), eq(conversations.userId, userId)),
    });
    if (found) return found;
  }
  const latest = await db.query.conversations.findFirst({
    where: eq(conversations.userId, userId),
    orderBy: desc(conversations.updatedAt),
  });
  if (latest) return latest;
  const [created] = await db.insert(conversations).values({ userId }).returning();
  return created;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);

    let conversationId: string | undefined;
    let text = "";
    let compressed: Awaited<ReturnType<typeof compressMealPhoto>> | undefined;
    let image: { mimeType: string; data: string } | undefined;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = ((form.get("text") as string) ?? "").trim();
      conversationId = (form.get("conversationId") as string) || undefined;
      const file = form.get("photo");
      if (file instanceof File && file.size > 0) {
        if (!ALLOWED_IMAGE.has(file.type)) return ok({ error: `Unsupported image type: ${file.type}` }, 415);
        if (file.size > MAX_IMAGE_BYTES) return ok({ error: "That photo is over 12 MB." }, 413);
        compressed = await compressMealPhoto(new Uint8Array(await file.arrayBuffer()), file.type);
        image = { mimeType: compressed.contentType, data: Buffer.from(compressed.bytes).toString("base64") };
      }
    } else {
      const body = await req.json();
      text = (body.text ?? "").trim();
      conversationId = body.conversationId || undefined;
    }

    if (!text && !image) return ok({ error: "Say something, or attach a photo." }, 400);

    const imageUrl = compressed
      ? await putMealPhoto(user.id, compressed.bytes, compressed.contentType).catch(() => null)
      : null;

    const thread = await resolveThread(user.id, conversationId);

    const [userMessage] = await db
      .insert(messages)
      .values({
        userId: user.id,
        conversationId: thread.id,
        role: "user",
        text: text || "\u{1F4F7} Photo",
        imageUrl,
      })
      .returning();

    await db
      .update(conversations)
      .set({
        ...(thread.title === "New chat" && text ? { title: text.slice(0, 60) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, thread.id));

    // Groq cannot see, so hand the agent a description instead of the pixels.
    const described = image ? await describePhoto(image, text || undefined) : null;

    const latestWeight = await db.query.weightLogs.findFirst({
      where: (w, { eq: e }) => e(w.userId, user.id),
      orderBy: (w, { desc: d }) => d(w.measuredAt),
    });

    const context = [
      `[Local time: ${localContext(profile.timezone)} (${profile.timezone}).`,
      latestWeight ? ` Bodyweight ${latestWeight.weightKg} kg.` : "",
      described ? ` They attached a photo showing: ${described}` : "",
      "]",
    ].join("");

    let reply: string;
    let cards: Awaited<ReturnType<typeof runAgent>>["cards"] = [];
    let kind = "question";

    try {
      const run = await runAgent({
        userId: user.id,
        profile,
        threadId: thread.id,
        message: text || "Log what is in the photo.",
        imageUrl,
        context,
      });
      reply = run.reply;
      cards = run.cards;
      kind = cards[0]?.kind ?? "question";
    } catch (err) {
      reply = `I couldn't work that one out. ${err instanceof Error ? err.message : ""}`.trim();
      kind = "error";
    }

    const [assistantMessage] = await db
      .insert(messages)
      .values({
        userId: user.id,
        conversationId: thread.id,
        role: "assistant",
        text: reply,
        kind,
        payload: cards,
      })
      .returning();

    return ok({ userMessage, assistantMessage, conversationId: thread.id }, 201);
  } catch (e) {
    return apiError(e);
  }
}
