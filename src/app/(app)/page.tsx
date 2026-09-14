import Link from "next/link";
import {
  Barbell, CaretRight, Drop, Footprints, PersonSimple, Sparkle, Timer,
} from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth";
import { getDaySummary, getTrend } from "@/lib/stats";
import { timeInTz } from "@/lib/dates";
import { hours, kcal, kg } from "@/lib/format";
import { MacroSplit, MEAL_ICON, MEAL_TINT } from "@/components/macro-split";
import { MetricCard, Spark } from "@/components/metric-card";
import { Panel } from "@/components/ui";
import { ArtPlate } from "@/components/art";

export const dynamic = "force-dynamic";

export default async function Today() {
  const user = await requireUser();
  const [summary, trend] = await Promise.all([getDaySummary(user.id), getTrend(user.id, 7)]);

  const t = summary.targets;
  const left = t.calories != null ? t.calories - summary.totals.calories : null;
  const over = left != null && left < 0;
  const pct = t.calories ? Math.min(1, summary.totals.calories / t.calories) : 0;

  const hour = Number(
    new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: summary.tz }).format(new Date()),
  );
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = (user.name ?? "").split(" ")[0];

  return (
    <main className="min-w-0 flex-1 px-5 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <p className="rise text-[14px] font-semibold text-[var(--ink-3)]">
          {greeting}{name ? `, ${name}` : ""}
        </p>

        <div className="rise mt-4 flex items-end gap-5" style={{ animationDelay: "40ms" }}>
          <div className="min-w-0 flex-1">
            <p className="hero-num text-[68px] lg:text-[80px]" style={{ color: over ? "var(--critical)" : "var(--ink)" }}>
              {left == null ? kcal(summary.totals.calories) : kcal(Math.abs(left))}
            </p>
            <p className="mt-2.5 text-[14px] font-semibold text-[var(--ink-2)]">
              {left == null ? "kcal eaten today" : over ? "kcal over budget" : "kcal left today"}
            </p>
          </div>
          <svg viewBox="0 0 88 88" className="size-[74px] shrink-0 -rotate-90">
            <circle cx="44" cy="44" r="38" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke={over ? "var(--critical)" : "var(--brand)"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 38}
              strokeDashoffset={2 * Math.PI * 38 * (1 - pct)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
            />
          </svg>
        </div>

        <Panel className="rise mt-5" style={{ animationDelay: "80ms" }}>
          <MacroSplit
            calories={summary.totals.calories}
            proteinG={summary.totals.proteinG}
            carbsG={summary.totals.carbsG}
            fatG={summary.totals.fatG}
          />
        </Panel>

        {/* the primary action lives one tap away, not buried in a form */}
        <Link
          href="/chat"
          className="rise mt-3 flex items-center gap-3.5 rounded-[24px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-sm)] transition-all active:scale-[0.99] hover:border-[var(--hairline-strong)]"
          style={{ animationDelay: "120ms" }}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tint-move)] text-[var(--tint-move-ink)]">
            <Sparkle weight="fill" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Log something</span>
            <span className="block text-[13px] text-[var(--ink-3)]">Type it, or snap a photo of your plate</span>
          </span>
          <CaretRight weight="bold" className="size-4 shrink-0 text-[var(--ink-3)]" />
        </Link>

        <div className="stagger mt-3 grid grid-cols-2 gap-3">
          <MetricCard
            href="/body" tint="move" label="Steps" icon={<Footprints weight="fill" />}
            value={summary.health?.steps ? summary.health.steps.toLocaleString("en-US") : "0"}
            sub={`Goal ${summary.profile.stepTarget.toLocaleString("en-US")}`}
            spark={<Spark values={trend.map((d) => d.steps)} tint="move" />}
            style={{ "--i": 4 } as React.CSSProperties}
          />
          <MetricCard
            href="/body" tint="water" label="Water" icon={<Drop weight="fill" />}
            value={(summary.waterMl / 1000).toFixed(1)} unit="L"
            sub={`Goal ${(summary.profile.waterTargetMl / 1000).toFixed(1)} L`}
            spark={<Spark values={trend.map((d) => d.waterMl)} tint="water" />}
            style={{ "--i": 5 } as React.CSSProperties}
          />
          <MetricCard
            href="/body" tint="body" label="Weight" icon={<PersonSimple weight="fill" />}
            value={kg(summary.latestWeight?.weightKg)} unit="kg"
            sub={summary.profile.targetWeightKg ? `Target ${kg(summary.profile.targetWeightKg)} kg` : "Set a target"}
            style={{ "--i": 6 } as React.CSSProperties}
          />
          <MetricCard
            href="/body" tint="time" label="Fasted" icon={<Timer weight="fill" />}
            value={summary.fasting.hours != null ? hours(summary.fasting.hours) : "0h 00m"}
            sub={`Goal ${Math.round(summary.fasting.targetHours)}h`}
            style={{ "--i": 7 } as React.CSSProperties}
          />
        </div>

        {summary.meals.length === 0 && summary.workouts.length === 0 && (
          <Panel className="mt-3" flush>
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <ArtPlate className="h-28 w-36" />
              <p className="mt-4 text-[16px] font-bold">Nothing logged yet today</p>
              <p className="mt-1.5 max-w-[16rem] text-[14px] leading-relaxed text-[var(--ink-3)]">
                Tell me what you ate in your own words and I will work out the numbers.
              </p>
              <ul className="mt-5 flex w-full flex-col gap-2">
                {[
                  "2 rotis, dal and a bowl of curd",
                  "bench 4x8 60kg, then 15 min treadmill",
                  "72.2 kg this morning",
                ].map((p) => (
                  <li key={p}>
                    <Link
                      href={`/chat?q=${encodeURIComponent(p)}`}
                      className="block rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-left text-[13px] text-[var(--ink-2)] transition-transform active:scale-[0.99]"
                    >
                      <span className="mr-2 text-[var(--ink-3)]">Try</span>
                      {p}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        )}

        {summary.meals.length > 0 && (
          <Panel className="mt-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold">Eaten today</h2>
              <Link href="/food" className="text-[13px] font-bold text-[var(--brand)]">All food</Link>
            </div>
            <ul className="divide-y divide-[var(--hairline)]">
              {summary.meals.map((m) => {
                const Icon = MEAL_ICON[m.mealType as keyof typeof MEAL_ICON] ?? MEAL_ICON.snack;
                const tint = MEAL_TINT[m.mealType as keyof typeof MEAL_TINT] ?? "cal";
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-full"
                      style={{ background: `var(--tint-${tint})`, color: `var(--tint-${tint}-ink)` }}
                    >
                      <Icon weight="fill" className="size-[17px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{m.name}</span>
                      <span className="block text-[12px] text-[var(--ink-3)]">{timeInTz(m.eatenAt, summary.tz)}</span>
                    </span>
                    <span className="tnum shrink-0 text-[14px] font-bold">{kcal(m.calories)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {summary.workouts.length > 0 && (
          <Panel className="mt-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold">Trained today</h2>
              <Link href="/train" className="text-[13px] font-bold text-[var(--brand)]">All sessions</Link>
            </div>
            <ul className="divide-y divide-[var(--hairline)]">
              {summary.workouts.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tint-move)] text-[var(--tint-move-ink)]">
                    <Barbell weight="fill" className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{w.title}</span>
                    <span className="block text-[12px] text-[var(--ink-3)]">{timeInTz(w.performedAt, summary.tz)}</span>
                  </span>
                  {w.caloriesBurned != null && (
                    <span className="tnum shrink-0 text-[14px] font-bold">{kcal(w.caloriesBurned)}</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </main>
  );
}
