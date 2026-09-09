"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Dumbbell,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/* --------------------------------------------------------------- shared */

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(fn: () => Promise<Response>, successMessage?: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return null;
      }
      if (successMessage) {
        setDone(successMessage);
        setTimeout(() => setDone(null), 3500);
      }
      router.refresh();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, done, setError, run };
}

function Status({ error, done }: { error: string | null; done: string | null }) {
  if (!error && !done) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        error
          ? "border-[var(--critical)]/40 bg-[var(--critical)]/10 text-[var(--critical)]"
          : "border-[var(--good)]/40 bg-[var(--good)]/10 text-[var(--good)]"
      }`}
    >
      {error ? <X className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
      <span className="min-w-0">{error ?? done}</span>
    </p>
  );
}

/** Local datetime string for <input type="datetime-local">. */
function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/* ----------------------------------------------------------------- food */

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export function FoodLogger() {
  const { busy, error, done, setError, run } = useSubmit();
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState<string>("");
  const [when, setWhen] = useState(nowLocalInput());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!text.trim() && !file) {
      setError("Describe the meal or add a photo.");
      return;
    }
    const form = new FormData();
    if (text.trim()) form.set("text", text.trim());
    if (mealType) form.set("mealType", mealType);
    form.set("eatenAt", new Date(when).toISOString());
    if (file) form.set("photo", file);

    const data = await run(
      () => fetch("/api/food", { method: "POST", body: form }),
      "Logged.",
    );
    if (data) {
      setText("");
      pick(null);
      if (fileInput.current) fileInput.current.value = "";
      setWhen(nowLocalInput());
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="textarea min-h-[86px] resize-y"
        placeholder="2 rotis, dal, a bowl of curd and half a mango, or just snap a photo"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />

      {preview && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Meal to be analysed" className="h-28 rounded-lg border border-[var(--border)] object-cover" />
          <button
            onClick={() => {
              pick(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
            className="absolute -right-2 -top-2 rounded-full bg-[var(--surface-2)] p-1 shadow ring-1 ring-[var(--border-strong)]"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost" disabled={busy}>
          <Camera className="size-4" />
          {file ? "Change photo" : "Photo"}
        </button>

        <select
          className="select !w-auto !py-2 text-sm"
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          disabled={busy}
          aria-label="Meal type"
        >
          <option value="">Auto</option>
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {m[0].toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          className="input !w-auto !py-2 text-sm"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          disabled={busy}
          aria-label="Time eaten"
        />

        <button onClick={submit} disabled={busy} className="btn-primary ml-auto">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "Analysing…" : "Log meal"}
        </button>
      </div>

      <Status error={error} done={done} />
    </div>
  );
}

/* --------------------------------------------------------------- weight */

export function WeightLogger({ lastKg }: { lastKg?: number | null }) {
  const { busy, error, done, run } = useSubmit();
  const [kg, setKg] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [when, setWhen] = useState(nowLocalInput());

  async function submit() {
    const data = await run(
      () =>
        fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightKg: Number(kg),
            bodyFatPct: bodyFat ? Number(bodyFat) : null,
            measuredAt: new Date(when).toISOString(),
          }),
        }),
      "Weight saved.",
    );
    if (data) {
      setKg("");
      setBodyFat("");
      setWhen(nowLocalInput());
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[110px] flex-1 flex-col gap-1">
          <span className="label">Weight (kg)</span>
          <input
            className="input tnum"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder={lastKg ? lastKg.toFixed(1) : "72.5"}
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex min-w-[100px] flex-1 flex-col gap-1">
          <span className="label">Body fat %</span>
          <input
            className="input tnum"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="optional"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex min-w-[170px] flex-1 flex-col gap-1">
          <span className="label">When</span>
          <input
            type="datetime-local"
            className="input"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={busy}
          />
        </label>
        <button onClick={submit} disabled={busy || !kg} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />}
          Save
        </button>
      </div>
      <Status error={error} done={done} />
    </div>
  );
}

/* ---------------------------------------------------------------- water */

export function WaterQuickAdd({ presets = [200, 300, 500, 750] }: { presets?: number[] }) {
  const { busy, error, done, run } = useSubmit();
  const [custom, setCustom] = useState("");

  const add = (ml: number) =>
    run(
      () =>
        fetch("/api/water", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountMl: ml }),
        }),
      ml > 0 ? `+${ml} ml` : `${ml} ml`,
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((ml) => (
          <button key={ml} onClick={() => add(ml)} disabled={busy} className="btn-ghost">
            <Plus className="size-3.5" />
            {ml} ml
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            className="input tnum !w-24 !py-2 text-sm"
            type="number"
            inputMode="numeric"
            placeholder="custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={busy}
            aria-label="Custom amount in ml"
          />
          <button
            onClick={() => {
              if (custom) {
                add(Number(custom));
                setCustom("");
              }
            }}
            disabled={busy || !custom}
            className="btn-ghost"
          >
            Add
          </button>
        </div>
        <button
          onClick={() => add(-250)}
          disabled={busy}
          className="btn-ghost ml-auto"
          title="Undo 250 ml"
        >
          −250 ml
        </button>
      </div>
      <Status error={error} done={done} />
    </div>
  );
}

/* ------------------------------------------------------------- training */

export function WorkoutLogger() {
  const { busy, error, done, setError, run } = useSubmit();
  const [text, setText] = useState("");
  const [when, setWhen] = useState(nowLocalInput());

  async function submit() {
    if (text.trim().length < 3) {
      setError("Tell me what you did.");
      return;
    }
    const data = await run(
      () =>
        fetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), performedAt: new Date(when).toISOString() }),
        }),
      "Session logged.",
    );
    if (data) {
      setText("");
      setWhen(nowLocalInput());
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="textarea min-h-[92px] resize-y"
        placeholder={"Push day, bench 4x8 60kg, incline db press 3x10 22.5, cable fly 3x12, 15 min treadmill\nor: walked 45 min around the park"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          className="input !w-auto !py-2 text-sm"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          disabled={busy}
          aria-label="Time performed"
        />
        <button onClick={submit} disabled={busy} className="btn-primary ml-auto">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}
          {busy ? "Parsing…" : "Log session"}
        </button>
      </div>
      <Status error={error} done={done} />
    </div>
  );
}

/* -------------------------------------------------------------- generic */

export function DeleteButton({
  endpoint,
  label = "Delete",
  confirm: needsConfirm = true,
}: {
  endpoint: string;
  label?: string;
  confirm?: boolean;
}) {
  const { busy, run } = useSubmit();
  const [armed, setArmed] = useState(false);

  async function go() {
    if (needsConfirm && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    await run(() => fetch(endpoint, { method: "DELETE" }));
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className={`rounded-md p-1.5 transition-colors ${
        armed
          ? "bg-[var(--critical)]/15 text-[var(--critical)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--critical)]"
      }`}
      title={armed ? "Tap again to confirm" : label}
      aria-label={armed ? "Confirm delete" : label}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}

export function ActionButton({
  endpoint,
  body,
  children,
  className = "btn-primary",
  successMessage,
}: {
  endpoint: string;
  body?: unknown;
  children: ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const { busy, error, done, run } = useSubmit();
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() =>
          run(
            () =>
              fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
              }),
            successMessage,
          )
        }
        disabled={busy}
        className={className}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
      <Status error={error} done={done} />
    </div>
  );
}
