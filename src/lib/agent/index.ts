import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import type { ChatResultCard } from "@/db/schema";
import type { Profile } from "@/lib/auth";
import { buildTools, type ToolContext } from "./tools";

/**
 * The logging agent.
 *
 * Groq drives the loop because it is fast and its free tier is generous.
 * Conversation state lives in MongoDB through LangGraph's checkpointer, keyed
 * by thread, so each chat keeps its own memory and a follow-up like "make that
 * three" resolves against the right turn. Domain data still lands in Postgres
 * through the tools; Mongo holds only the agent's own scratch state.
 */
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const SYSTEM = `You log a weight-loss tracker by calling tools.

- One message can hold several things: "2 eggs then walked 40 min" is log_food AND log_workout.
- Branded or restaurant food: call search_nutrition first, then log the found figures scaled to
  the portion eaten. Never search home-cooked or generic food.
- A question ("how many calories left?") means call get_today and answer. Log nothing.
- A correction ("actually make that 3") means call undo_last for that kind, then log it again in full.
- Name food by what it is, not the meal slot. Take mealType from their words if they said one.
- Indian home cooking assumes normal ghee or oil. Estimate rather than asking; lower confidence instead.
- Finish with one short warm sentence including the key number. Plain text, no markdown, no emoji,
  and never an em dash.`;

let client: MongoClient | null = null;
let saver: MongoDBSaver | null = null;

function checkpointer(): MongoDBSaver | undefined {
  const uri = process.env.MONGODB_URI;
  if (!uri) return undefined; // the agent still works, just without memory
  if (!saver) {
    client ??= new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    saver = new MongoDBSaver({ client, dbName: process.env.MONGODB_DB ?? "cut" });
  }
  return saver;
}

/** Neither provider is allowed to hold a request open indefinitely. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

export type AgentRun = {
  reply: string;
  cards: ChatResultCard[];
};

export async function runAgent(input: {
  userId: string;
  profile: Profile;
  threadId: string;
  message: string;
  imageUrl: string | null;
  /** Local time and today's numbers, refreshed every turn. */
  context: string;
}): Promise<AgentRun> {
  const ctx: ToolContext = {
    userId: input.userId,
    profile: input.profile,
    imageUrl: input.imageUrl,
    cards: [],
  };

  const tools = buildTools(ctx);
  const saver = checkpointer();

  const run = (llm: Parameters<typeof createReactAgent>[0]["llm"]) =>
    withTimeout(
      createReactAgent({ llm, tools, checkpointer: saver, prompt: SYSTEM }).invoke(
        { messages: [{ role: "user", content: `${input.context}\n\n${input.message}` }] },
        { configurable: { thread_id: input.threadId }, recursionLimit: 10 },
      ),
      25_000,
    );

  let result;
  try {
    result = await run(
      new ChatGroq({
        model: MODEL,
        apiKey: process.env.GROQ_API_KEY,
        temperature: 0.2,
        maxRetries: 1,
      }),
    );
  } catch (err) {
    // Groq's free tier is 8k tokens a minute, which a busy day can exhaust.
    // Gemini has plenty of ungrounded capacity, so the log still goes through.
    if (!process.env.GOOGLE_API_KEY) throw err;
    result = await run(
      new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_AGENT_MODEL || "gemini-2.5-flash",
        apiKey: process.env.GOOGLE_API_KEY,
        temperature: 0.2,
        maxRetries: 1,
      }),
    );
  }

  const last = result.messages.at(-1);
  const raw = last?.content;
  const reply =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((p) => (typeof p === "string" ? p : ((p as { text?: string }).text ?? ""))).join("")
        : "";

  return {
    reply: reply.trim() || (ctx.cards.length ? "Logged." : "I did not catch that one."),
    cards: ctx.cards,
  };
}

export const agentConfigured = () => Boolean(process.env.GROQ_API_KEY);
export const memoryConfigured = () => Boolean(process.env.MONGODB_URI);
