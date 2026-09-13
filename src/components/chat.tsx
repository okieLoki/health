"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Barbell,
  Camera,
  CaretDown,
  Drop,
  ForkKnife,
  PersonSimple,
  Timer,
  Warning,
  X,
} from "@phosphor-icons/react";

type Card = {
  kind: "food" | "workout" | "weight" | "water" | "fast_start" | "fast_end";
  id: string | null;
  title: string;
  lines: string[];
  facts?: { label: string; value: string }[];
  sources?: { title: string; uri: string }[];
};

export type ChatMessage = {
  id: string;
  role: string;
  text: string;
  imageUrl: string | null;
  kind: string | null;
  payload: Card[] | null;
  createdAt: string;
};

const CARD_ICON = {
  food: ForkKnife,
  workout: Barbell,
  weight: PersonSimple,
  water: Drop,
  fast_start: Timer,
  fast_end: Timer,
} as const;

const CARD_TINT = {
  food: "cal",
  workout: "move",
  weight: "body",
  water: "water",
  fast_start: "time",
  fast_end: "time",
} as const;

const PROMPTS = [
  "2 rotis, dal and a bowl of curd",
  "bench 4x8 60kg, then 15 min treadmill",
  "82.4 kg this morning",
  "drank a bottle of water",
];

export function Chat({ initial }: { initial: ChatMessage[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState(() => params.get("q") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length > initial.length ? "smooth" : "auto" });
  }, [messages.length, initial.length]);

  function pick(f: File | null) {
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function send() {
    const body = text.trim();
    if ((!body && !file) || pending) return;

    // Optimistic echo so the thread feels instant.
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      text: body || "📷 Photo",
      imageUrl: null,
      kind: null,
      payload: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    if (areaRef.current) areaRef.current.style.height = "auto";
    const sentFile = file;
    pick(null);
    if (fileRef.current) fileRef.current.value = "";
    setPending(true);
    setError(null);

    try {
      const form = new FormData();
      if (body) form.set("text", body);
      if (sentFile) form.set("photo", sentFile);

      const res = await fetch("/api/chat", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Something went wrong (${res.status})`);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setText(body);
        return;
      }

      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      router.refresh(); // pull the day totals at the top back in sync
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(body);
    } finally {
      setPending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-4 lg:px-0">
        {empty ? (
          <EmptyState onPick={(p) => { setText(p); areaRef.current?.focus(); }} />
        ) : (
          <ol className="mx-auto flex max-w-2xl flex-col gap-5 py-2">
            {messages.map((m, i) => (
              <li key={m.id} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}>
                {m.role === "user" ? <UserBubble message={m} /> : <AssistantBlock message={m} />}
              </li>
            ))}
            {pending && (
              <li className="fade">
                <Thinking />
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      {/* ------------------------------------------------------ composer */}
      <div
        className="sticky bottom-0 z-20 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)] to-transparent px-5 pt-6 lg:px-0 lg:pb-5"
        style={{ paddingBottom: "calc(74px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl">
          {error && (
            <p role="alert" className="pop mb-2 flex items-start gap-2 rounded-2xl border border-[var(--critical)]/35 bg-[var(--critical)]/8 px-3.5 py-2.5 text-sm text-[var(--critical)]">
              <Warning weight="fill" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">{error}</span>
            </p>
          )}

          {preview && (
            <div className="pop relative mb-2 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Attached" className="h-24 rounded-2xl border border-[var(--hairline)] object-cover" />
              <button
                onClick={() => { pick(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-[var(--ink)] text-[var(--surface)] shadow-lg"
                aria-label="Remove photo"
              >
                <X weight="bold" className="size-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-[26px] border border-[var(--hairline-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] transition-shadow focus-within:border-[var(--brand)] focus-within:shadow-[var(--shadow-lg)]">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] active:scale-95 disabled:opacity-50"
              aria-label="Add a photo"
            >
              <Camera weight="regular" className="size-[22px]" />
            </button>

            <textarea
              ref={areaRef}
              rows={1}
              value={text}
              disabled={pending}
              onChange={(e) => { setText(e.target.value); grow(e.target); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="What did you eat, lift or weigh?"
              className="max-h-[140px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-snug text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
            />

            <button
              onClick={send}
              disabled={pending || (!text.trim() && !file)}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-ink)] transition-all hover:bg-[var(--brand-hover)] active:scale-95 disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp weight="bold" className="size-[18px]" />
            </button>
          </div>


        </div>
      </div>
    </div>
  );
}
