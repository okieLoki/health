import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Chat, type ChatMessage } from "@/components/chat";

export const metadata: Metadata = { title: "Ask" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser();
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.userId, user.id))
    .orderBy(desc(messages.createdAt))
    .limit(40);

  const initial: ChatMessage[] = thread.reverse().map((m) => ({
    id: m.id, role: m.role, text: m.text, imageUrl: m.imageUrl,
    kind: m.kind, payload: m.payload, createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-5 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.04em] lg:text-[32px]">
            Ask
          </h1>
          <p className="mt-1 text-[15px] text-[var(--ink-2)]">
            Say what you ate, lifted or weighed. I will file it.
          </p>
        </div>
      </div>
      <Suspense fallback={null}>
        <Chat initial={initial} />
      </Suspense>
    </div>
  );
}
