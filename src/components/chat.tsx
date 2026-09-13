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

/* ----------------------------------------------------------------- parts */

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        {message.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/photos/${message.imageUrl}`}
            alt=""
            className="mb-1.5 ml-auto max-h-56 rounded-3xl rounded-br-lg border border-[var(--hairline)] object-cover"
          />
        )}
        {message.text && (
          <p className="rounded-3xl rounded-br-lg bg-[var(--brand)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--brand-ink)]">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function AssistantBlock({ message }: { message: ChatMessage }) {
  const failed = message.kind === "error";
  return (
    <div className="flex flex-col gap-2.5">
      <p
        className={`max-w-[92%] text-[15px] leading-relaxed ${
          failed ? "text-[var(--critical)]" : "text-[var(--ink)]"
        }`}
      >
        {message.text}
      </p>
      {message.payload?.map((card, i) => <ResultCard key={i} card={card} />)}
    </div>
  );
}

function ResultCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const Icon = CARD_ICON[card.kind] ?? ForkKnife;
  const hasDetail = card.lines.length > 0 || (card.sources?.length ?? 0) > 0;

  return (
    <article className="pop overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3 p-4">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-2xl"
          style={{ background: `var(--tint-${CARD_TINT[card.kind]})`, color: `var(--tint-${CARD_TINT[card.kind]}-ink)` }}
        >
          <Icon weight="fill" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-tight">{card.title}</h3>
          {card.facts && card.facts.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {card.facts.map((f) => (
                <div key={f.label} className="flex items-baseline gap-1.5">
                  <dt className="text-[11px] font-medium text-[var(--ink-3)]">{f.label}</dt>
                  <dd className="tnum text-[13px] font-bold">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {hasDetail && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-2)]"
            aria-expanded={open}
            aria-label={open ? "Hide detail" : "Show detail"}
          >
            <CaretDown weight="bold" className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {hasDetail && open && (
        <div className="fade border-t border-[var(--hairline)] bg-[var(--surface-2)] px-4 py-3">
          {card.lines.length > 0 && (
            <ul className="space-y-1.5">
              {card.lines.map((l, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-snug text-[var(--ink-2)]">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--ink-3)]" />
                  {l}
                </li>
              ))}
            </ul>
          )}
          {card.sources && card.sources.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
              <span className="font-semibold">Looked up:</span>
              {card.sources.map((s) => (
                <a
                  key={s.uri}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 hover:text-[var(--brand)]"
                >
                  {s.title}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-[var(--ink-3)]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-current"
          style={{ animation: `breathe 1.2s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
      <span className="ml-1 text-[13px]">Working it out…</span>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-2 py-10 text-center">
      <Plate />
      <h2 className="rise mt-6 text-[22px] font-extrabold tracking-[-0.03em]">Just tell me what happened</h2>
      <p className="rise mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--ink-2)]" style={{ animationDelay: "60ms" }}>
        Food, training, your weight, water, in whatever words come naturally. I&apos;ll work out
        the numbers and file it in the right place.
      </p>
      <ul className="stagger mt-7 flex w-full flex-col gap-2">
        {PROMPTS.map((p, i) => (
          <li key={p} style={{ "--i": i + 2 } as React.CSSProperties}>
            <button
              onClick={() => onPick(p)}
              className="w-full rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-left text-[14px] text-[var(--ink-2)] transition-all hover:border-[var(--brand)] hover:text-[var(--ink)] active:scale-[0.99]"
            >
              <span className="mr-2 text-[var(--ink-3)]">Try</span>
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Spot illustration: a plate with the app's arc motif as the meal. */
function Plate() {
  return (
    <svg viewBox="0 0 160 120" className="pop h-28 w-40" role="img" aria-label="">
      <ellipse cx="80" cy="102" rx="52" ry="7" fill="var(--ink)" opacity="0.06" />
      <circle cx="80" cy="60" r="42" fill="var(--surface-2)" stroke="var(--hairline-strong)" strokeWidth="2" />
      <circle cx="80" cy="60" r="31" fill="var(--surface)" stroke="var(--hairline)" strokeWidth="1.5" />
      <path d="M99 44a24 24 0 1 0 0 32" fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="99" cy="76" r="5.5" fill="var(--brand)" />
      <circle cx="36" cy="34" r="4" fill="var(--series-2)" opacity="0.9" />
      <circle cx="128" cy="30" r="3" fill="var(--series-1)" opacity="0.85" />
      <circle cx="132" cy="86" r="3.5" fill="var(--series-3)" opacity="0.85" />
    </svg>
  );
}
