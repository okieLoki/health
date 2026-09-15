"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Barbell,
  CheckCircle,
  Drop,
  PersonSimple,
  Target,
  Timer,
} from "@phosphor-icons/react";
import { ACTIVITY_LABEL } from "@/lib/nutrition";

type Draft = {
  sex: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: string;
  targetWeightKg: number | null;
  weeklyRateKg: number;
  activityLevel: string;
  waterTargetMl: number;
  stepTarget: number;
  fastingTargetHours: number;
  timezone: string;
};

const STEPS = ["You", "Weight", "Pace", "Habits"] as const;

export function Onboarding({
  initial,
  editing,
}: {
  initial: Partial<Draft>;
  editing: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [d, setD] = useState<Draft>({
    sex: initial.sex ?? null,
    birthDate: initial.birthDate ?? null,
    heightCm: initial.heightCm ?? null,
    weightKg: initial.weightKg ?? null,
    goal: initial.goal ?? "lose",
    targetWeightKg: initial.targetWeightKg ?? null,
    weeklyRateKg: initial.weeklyRateKg ?? 0.5,
    activityLevel: initial.activityLevel ?? "light",
    waterTargetMl: initial.waterTargetMl ?? 3000,
    stepTarget: initial.stepTarget ?? 10000,
    fastingTargetHours: initial.fastingTargetHours ?? 16,
    timezone: initial.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const canAdvance =
    step === 0 ? Boolean(d.sex && d.birthDate && d.heightCm)
    : step === 1 ? Boolean(d.weightKg)
    : true;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex: d.sex, birthDate: d.birthDate, heightCm: d.heightCm,
          goal: d.goal, targetWeightKg: d.targetWeightKg, weeklyRateKg: d.weeklyRateKg,
          activityLevel: d.activityLevel, waterTargetMl: d.waterTargetMl,
          stepTarget: d.stepTarget, fastingTargetHours: d.fastingTargetHours,
          timezone: d.timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0] ?? "Could not save");
        return;
      }
      if (d.weightKg && !editing) {
        await fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightKg: d.weightKg }),
        });
      }
      router.push(editing ? "/you" : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-8 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* progress */}
        <div className="mb-10 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors duration-500 ${
                  i <= step ? "bg-[var(--brand)]" : "bg-[var(--surface-3)]"
                }`}
              />
            </div>
          ))}
        </div>

        <div key={step} className="rise flex-1">
          {step === 0 && (
            <Step
              icon={<PersonSimple weight="fill" />}
              title="Tell me about you"
              hint="These three numbers drive every calorie target in the app."
            >
              <Field label="Sex">
                <Choice
                  value={d.sex}
                  onChange={(v) => set("sex", v)}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                />
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  The BMR equation needs a biological sex constant.
                </p>
              </Field>
              <Field label="Date of birth">
                <input
                  type="date" className="input"
                  value={d.birthDate ?? ""}
                  onChange={(e) => set("birthDate", e.target.value || null)}
                />
              </Field>
              <Field label="Height">
                <div className="relative">
                  <input
                    type="number" inputMode="decimal" step="0.5" className="input tnum pr-12"
                    placeholder="175"
                    value={d.heightCm ?? ""}
                    onChange={(e) => set("heightCm", e.target.value ? Number(e.target.value) : null)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--ink-3)]">cm</span>
                </div>
              </Field>
            </Step>
          )}

          {step === 1 && (
            <Step
              icon={<Target weight="fill" />}
              title="Where are you now?"
              hint="You can log new weigh-ins any time just by saying them."
            >
              <Field label="Current weight">
                <div className="relative">
                  <input
                    type="number" inputMode="decimal" step="0.1" className="input tnum pr-12 !text-[28px] !font-bold"
                    placeholder="82.4"
                    value={d.weightKg ?? ""}
                    onChange={(e) => set("weightKg", e.target.value ? Number(e.target.value) : null)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--ink-3)]">kg</span>
                </div>
              </Field>
              <Field label="Target weight (optional)">
                <div className="relative">
                  <input
                    type="number" inputMode="decimal" step="0.1" className="input tnum pr-12"
                    placeholder="72.0"
                    value={d.targetWeightKg ?? ""}
                    onChange={(e) => set("targetWeightKg", e.target.value ? Number(e.target.value) : null)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--ink-3)]">kg</span>
                </div>
              </Field>
            </Step>
          )}

          {step === 2 && (
            <Step
              icon={<Barbell weight="fill" />}
              title="How fast, and how active?"
              hint="Half a kilo a week is roughly a 550 kcal daily deficit."
            >
              <Field label="Goal">
                <Choice
                  value={d.goal}
                  onChange={(v) => set("goal", v ?? "lose")}
                  options={[
                    { value: "lose", label: "Lose fat" },
                    { value: "maintain", label: "Maintain" },
                    { value: "gain", label: "Gain" },
                  ]}
                />
              </Field>

              {d.goal !== "maintain" && (
                <Field label={`Rate: ${d.weeklyRateKg.toFixed(2)} kg per week`}>
                  <input
                    type="range" min="0.1" max="1" step="0.05"
                    value={d.weeklyRateKg}
                    onChange={(e) => set("weeklyRateKg", Number(e.target.value))}
                    className="w-full accent-[var(--brand)]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--ink-3)]">
                    <span>Gentle</span>
                    <span>Aggressive</span>
                  </div>
                </Field>
              )}

              <Field label="Activity level">
                <div className="flex flex-col gap-2">
                  {Object.entries(ACTIVITY_LABEL).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => set("activityLevel", k)}
                      className={`rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold transition-all active:scale-[0.99] ${
                        d.activityLevel === k
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "border-[var(--hairline-strong)] bg-[var(--surface)] text-[var(--ink-2)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  Ignored on days your Apple Watch reports active energy, because a measured
                  number beats a guess.
                </p>
              </Field>
            </Step>
          )}

          {step === 3 && (
            <Step
              icon={<CheckCircle weight="fill" />}
              title="A few daily habits"
              hint="Sensible defaults are already filled in. Change them whenever."
            >
              <Field label={`Water: ${(d.waterTargetMl / 1000).toFixed(1)} L a day`}>
                <input
                  type="range" min="1000" max="6000" step="250"
                  value={d.waterTargetMl}
                  onChange={(e) => set("waterTargetMl", Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                />
              </Field>
              <Field label={`Steps: ${d.stepTarget.toLocaleString("en-US")} a day`}>
                <input
                  type="range" min="2000" max="25000" step="500"
                  value={d.stepTarget}
                  onChange={(e) => set("stepTarget", Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                />
              </Field>
              <Field label={`Fasting window: ${d.fastingTargetHours} hours`}>
                <input
                  type="range" min="8" max="24" step="1"
                  value={d.fastingTargetHours}
                  onChange={(e) => set("fastingTargetHours", Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                />
              </Field>

              <div className="mt-2 flex items-start gap-2.5 rounded-2xl bg-[var(--tint-water)] p-4">
                <Drop weight="fill" className="mt-0.5 size-4 shrink-0 text-[var(--tint-water-ink)]" />
                <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
                  <Timer weight="fill" className="mr-1 inline size-3.5 align-[-2px]" />
                  Your fast is measured from your last logged meal, so you never have to start
                  a timer by hand.
                </p>
              </div>
            </Step>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-2xl bg-[var(--critical)]/10 px-4 py-3 text-[14px] text-[var(--critical)]">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="btn-ghost !px-4" aria-label="Back">
              <ArrowLeft weight="bold" className="size-[18px]" />
            </button>
          )}
          <button
            onClick={() => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1))}
            disabled={!canAdvance || busy}
            className="btn-primary flex-1"
          >
            {step === STEPS.length - 1 ? (busy ? "Saving" : editing ? "Save plan" : "Start tracking") : "Continue"}
            {step < STEPS.length - 1 && <ArrowRight weight="bold" className="size-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  icon, title, hint, children,
}: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] [&>svg]:size-6">
        {icon}
      </span>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em]">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{hint}</p>
      <div className="mt-8 flex flex-col gap-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[var(--ink-2)]">{label}</span>
      {children}
    </label>
  );
}

function Choice({
  value, onChange, options,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-2xl border px-3 py-3.5 text-[14px] font-bold transition-all active:scale-[0.98] ${
            value === o.value
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-[var(--hairline-strong)] bg-[var(--surface)] text-[var(--ink-2)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
