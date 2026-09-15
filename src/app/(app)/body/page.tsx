import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { ChatCircleDots, Drop, Footprints, Moon, Pulse, Timer } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { weightLogs } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { deriveTargets, getDaySummary, getTrend, trendRate } from "@/lib/stats";
import { timeInTz } from "@/lib/dates";
import { bmiBand, KCAL_PER_KG_FAT } from "@/lib/nutrition";
import { hours, kcal, kg } from "@/lib/format";
import { Empty, Panel, PageTitle, Pill, SectionTitle } from "@/components/ui";
import { MetricCard, Spark } from "@/components/metric-card";
import { EnergyChart, StepsChart, WaterChart, WeightChart } from "@/components/charts";
import { Segmented } from "@/components/segmented";
import { ArtScale } from "@/components/art";
import { DeleteButton } from "@/components/loggers";

export const metadata: Metadata = { title: "Body" };
export const dynamic = "force-dynamic";

export default async function BodyPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range } = await searchParams;
  const days = range === "90" ? 90 : range === "7" ? 7 : 30;

  const profile = await getProfile(user.id);
  const [summary, trend, entries] = await Promise.all([
    getDaySummary(user.id),
    getTrend(user.id, days),
    db
      .select()
      .from(weightLogs)
      .where(eq(weightLogs.userId, user.id))
      .orderBy(desc(weightLogs.measuredAt))
      .limit(40),
  ]);

  const rate = trendRate(trend);
  const latest = entries[0] ?? null;
  const targets = deriveTargets(profile, latest?.weightKg ?? null, null);
  const toGo = profile.targetWeightKg && latest ? latest.weightKg - profile.targetWeightKg : null;
  const weeksToGo = toGo != null && rate != null && rate < 0 ? Math.abs(toGo) / Math.abs(rate) : null;

  return (
    <main className="min-w-0 flex-1 px-5 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <PageTitle
          title="Body"
          subtitle="Weight, movement and recovery over time."
          action={
            <Suspense fallback={null}>
              <Segmented
                param="range"
                defaultValue="30"
                options={[
                  { value: "7", label: "7d" },
                  { value: "30", label: "30d" },
                  { value: "90", label: "90d" },
                ]}
              />
            </Suspense>
          }
        />

        {/* ------------------------------------------------------- hero */}
        <div className="rise mb-6">
          <p className="hero-num text-[64px] lg:text-[76px]">
            {kg(latest?.weightKg)}
            <span className="ml-2 text-[20px] font-semibold text-[var(--ink-3)]">kg</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {rate != null && (
              <Pill tone={rate < 0 ? "good" : rate > 0.1 ? "warning" : "default"}>
                {rate > 0 ? "+" : ""}
                {rate.toFixed(2)} kg per week
              </Pill>
            )}
            {targets.bmi && <Pill>BMI {targets.bmi.toFixed(1)} &middot; {bmiBand(targets.bmi).label}</Pill>}
            {latest && <Pill>Last read {timeInTz(latest.measuredAt, profile.timezone)}</Pill>}
          </div>
        </div>

        <div className="stagger mb-4 grid grid-cols-2 gap-3">
          <MetricCard
            tint="body" label="To target" icon={<Pulse weight="fill" />}
            value={toGo != null ? kg(Math.abs(toGo)) : "0.0"} unit="kg"
            sub={profile.targetWeightKg ? `Target ${kg(profile.targetWeightKg)} kg` : "Set one in You"}
            style={{ "--i": 0 } as React.CSSProperties}
          />
          <MetricCard
            tint="time" label="At this rate" icon={<Timer weight="fill" />}
            value={weeksToGo != null ? String(Math.ceil(weeksToGo)) : "0"} unit="weeks"
            sub={rate != null && rate < 0 ? `${Math.round((Math.abs(rate) * KCAL_PER_KG_FAT) / 7)} kcal deficit` : "Need a downward trend"}
            style={{ "--i": 1 } as React.CSSProperties}
          />
          <MetricCard
            tint="move" label="Steps today" icon={<Footprints weight="fill" />}
            value={summary.health?.steps ? summary.health.steps.toLocaleString("en-US") : "0"}
            sub={`Goal ${profile.stepTarget.toLocaleString("en-US")}`}
            spark={<Spark values={trend.slice(-7).map((d) => d.steps)} tint="move" />}
            style={{ "--i": 2 } as React.CSSProperties}
          />
          <MetricCard
            tint="water" label="Water today" icon={<Drop weight="fill" />}
            value={(summary.waterMl / 1000).toFixed(1)} unit="L"
            sub={`Goal ${(profile.waterTargetMl / 1000).toFixed(1)} L`}
            spark={<Spark values={trend.slice(-7).map((d) => d.waterMl)} tint="water" />}
            style={{ "--i": 3 } as React.CSSProperties}
          />
        </div>

        <div className="space-y-4">
          <WeightChart data={trend} goalKg={profile.targetWeightKg} />
          <EnergyChart data={trend} />
          <StepsChart data={trend} target={profile.stepTarget} />
          <WaterChart data={trend} target={profile.waterTargetMl} />

          <Panel>
            <SectionTitle title="Recovery" hint="From Apple Health once your shortcut has run." />
            <div className="grid grid-cols-3 gap-4">
              <Small icon={<Moon weight="fill" />} label="Sleep" value={summary.health?.sleepMin ? hours(summary.health.sleepMin / 60) : "0h 00m"} />
              <Small icon={<Pulse weight="fill" />} label="Resting HR" value={summary.health?.restingHr ? `${Math.round(summary.health.restingHr)}` : "0"} unit="bpm" />
              <Small icon={<Footprints weight="fill" />} label="Distance" value={summary.health?.distanceKm ? summary.health.distanceKm.toFixed(1) : "0.0"} unit="km" />
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Weigh-ins" hint={`${entries.length} readings`} />
            {entries.length === 0 ? (
              <Empty
                illustration={<ArtScale />}
                title="No readings yet"
                hint="Say your weight on Today and it lands here. Same time each morning gives the cleanest trend."
                action={
                  <Link href="/" className="btn-primary">
                    <ChatCircleDots weight="fill" className="size-[18px]" />
                    Log a weigh-in
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--hairline)]">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-[86px] shrink-0 text-[12px] text-[var(--ink-3)]">
                      {e.measuredAt.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: profile.timezone })}
                    </span>
                    <span className="tnum text-[15px] font-bold">{kg(e.weightKg)} kg</span>
                    {e.bodyFatPct && <span className="tnum text-[12px] text-[var(--ink-3)]">{e.bodyFatPct}% fat</span>}
                    {e.source === "apple" && <Pill>Apple</Pill>}
                    <span className="ml-auto flex items-center gap-2">
                      <span className="tnum text-[12px] text-[var(--ink-3)]">{timeInTz(e.measuredAt, profile.timezone)}</span>
                      <DeleteButton endpoint={`/api/weight/${e.id}`} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Small({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div>
      <span className="mb-2 grid size-8 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] [&>svg]:size-[15px]">
        {icon}
      </span>
      <p className="text-[12px] font-semibold text-[var(--ink-3)]">{label}</p>
      <p className="stat text-[19px] leading-tight">
        {value}
        {unit && <span className="ml-1 text-[12px] font-semibold text-[var(--ink-3)]">{unit}</span>}
      </p>
    </div>
  );
}
