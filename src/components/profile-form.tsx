"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, X } from "lucide-react";
import { ACTIVITY_LABEL } from "@/lib/nutrition";

type ProfileShape = {
  heightCm: number | null;
  birthDate: string | null;
  sex: string | null;
  activityLevel: string;
  goal: string;
  targetWeightKg: number | null;
  weeklyRateKg: number;
  timezone: string;
  waterTargetMl: number;
  stepTarget: number;
  fastingTargetHours: number;
  calorieTargetOverride: number | null;
  proteinTargetG: number | null;
  carbTargetG: number | null;
  fatTargetG: number | null;
  reportEnabled: string;
  reportHour: number;
};

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Europe/London",
  "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Australia/Sydney", "UTC",
];

export function ProfileForm({ initial }: { initial: ProfileShape }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof ProfileShape>(key: K, value: ProfileShape[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? (data.issues?.[0] ?? "Could not save") });
        return;
      }
      setMsg({ ok: true, text: "Saved." });
      setTimeout(() => setMsg(null), 3000);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <Group title="About you" hint="These feed the BMR equation, without them there's no real target.">
        <Field label="Sex">
          <select className="select" value={form.sex ?? ""} onChange={(e) => set("sex", e.target.value || null)}>
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input type="date" className="input" value={form.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value || null)} />
        </Field>
        <Field label="Height (cm)">
          <input type="number" step="0.5" inputMode="decimal" className="input tnum" placeholder="175"
            value={form.heightCm ?? ""} onChange={(e) => set("heightCm", numOrNull(e.target.value))} />
        </Field>
        <Field label="Timezone" hint="Decides where your day starts and ends.">
          <select className="select" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </Group>

      <Group title="Goal" hint="A 0.5 kg/week loss is about a 550 kcal daily deficit.">
        <Field label="Goal">
          <select className="select" value={form.goal} onChange={(e) => set("goal", e.target.value)}>
            <option value="lose">Lose fat</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Gain</option>
          </select>
        </Field>
        <Field label="Target weight (kg)">
          <input type="number" step="0.1" inputMode="decimal" className="input tnum" placeholder="70"
            value={form.targetWeightKg ?? ""} onChange={(e) => set("targetWeightKg", numOrNull(e.target.value))} />
        </Field>
        <Field label="Rate (kg / week)">
          <input type="number" step="0.05" min="0" max="1.5" inputMode="decimal" className="input tnum"
            value={form.weeklyRateKg} onChange={(e) => set("weeklyRateKg", Number(e.target.value))} />
        </Field>
        <Field label="Activity level" hint="Ignored on days your Apple Watch reports active energy.">
          <select className="select" value={form.activityLevel} onChange={(e) => set("activityLevel", e.target.value)}>
            {Object.entries(ACTIVITY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
      </Group>

      <Group title="Daily targets" hint="Leave the calorie and macro overrides blank to use the computed values.">
        <Field label="Water (ml)">
          <input type="number" step="100" className="input tnum" value={form.waterTargetMl}
            onChange={(e) => set("waterTargetMl", Number(e.target.value))} />
        </Field>
        <Field label="Steps">
          <input type="number" step="500" className="input tnum" value={form.stepTarget}
            onChange={(e) => set("stepTarget", Number(e.target.value))} />
        </Field>
        <Field label="Fasting window (h)">
          <input type="number" step="0.5" min="8" max="36" className="input tnum" value={form.fastingTargetHours}
            onChange={(e) => set("fastingTargetHours", Number(e.target.value))} />
        </Field>
        <Field label="Calorie override">
          <input type="number" step="10" className="input tnum" placeholder="auto"
            value={form.calorieTargetOverride ?? ""} onChange={(e) => set("calorieTargetOverride", numOrNull(e.target.value))} />
        </Field>
        <Field label="Protein override (g)">
          <input type="number" step="5" className="input tnum" placeholder="auto"
            value={form.proteinTargetG ?? ""} onChange={(e) => set("proteinTargetG", numOrNull(e.target.value))} />
        </Field>
        <Field label="Carbs override (g)">
          <input type="number" step="5" className="input tnum" placeholder="auto"
            value={form.carbTargetG ?? ""} onChange={(e) => set("carbTargetG", numOrNull(e.target.value))} />
        </Field>
        <Field label="Fat override (g)">
          <input type="number" step="5" className="input tnum" placeholder="auto"
            value={form.fatTargetG ?? ""} onChange={(e) => set("fatTargetG", numOrNull(e.target.value))} />
        </Field>
      </Group>

      <Group title="Daily email report" hint="Sent by Vercel Cron once a day.">
        <Field label="Send the report">
          <select className="select" value={form.reportEnabled} onChange={(e) => set("reportEnabled", e.target.value)}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
        <Field label="Preferred hour (local)" hint="Used when the cron runs more than once a day.">
          <input type="number" min="0" max="23" className="input tnum" value={form.reportHour}
            onChange={(e) => set("reportHour", Number(e.target.value))} />
        </Field>
      </Group>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save profile
        </button>
        {msg && (
          <p className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
            {msg.ok ? <Check className="size-4" /> : <X className="size-4" />}
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">{title}</legend>
      {hint && <p className="mb-3 mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-[var(--text-muted)]">{hint}</span>}
    </label>
  );
}
