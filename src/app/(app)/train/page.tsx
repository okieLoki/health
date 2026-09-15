import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { Barbell, ChatCircleDots, Clock, Fire, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { requireUser, getProfile } from "@/lib/auth";
import { dayKey, formatDuration, timeInTz } from "@/lib/dates";
import { count, kcal } from "@/lib/format";
import { Empty, Panel, PageTitle, Pill } from "@/components/ui";
import { MetricCard } from "@/components/metric-card";
import { ArtBarbell } from "@/components/art";
import { DeleteButton } from "@/components/loggers";

export const metadata: Metadata = { title: "Train" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  gym: "Gym", walk: "Walk", run: "Run", cardio: "Cardio", sport: "Sport", other: "Other",
};

export default async function TrainPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const since = new Date(Date.now() - 60 * 86_400_000);
  const sessions = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user.id), gte(workouts.performedAt, since)))
    .orderBy(desc(workouts.performedAt));

  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = sessions.filter((w) => w.performedAt.getTime() >= weekAgo);
  const volume = week.reduce((a, w) => a + (w.totalVolumeKg ?? 0), 0);
  const minutes = week.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const burned = week.reduce((a, w) => a + (w.caloriesBurned ?? 0), 0);

  const byDay = new Map<string, typeof sessions>();
  for (const w of sessions) {
    const key = dayKey(w.performedAt, profile.timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), w]);
  }

  return (
    <main className="min-w-0 flex-1 px-5 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Train" subtitle="Every session, parsed into sets and loads." />

        <div className="rise mb-6">
          <p className="hero-num text-[64px] lg:text-[76px]">{week.length}</p>
          <p className="mt-2.5 text-[14px] font-semibold text-[var(--ink-2)]">
            {week.length === 1 ? "session this week" : "sessions this week"}
          </p>
        </div>

        <div className="stagger mb-4 grid grid-cols-3 gap-3">
          <MetricCard
            tint="time" label="Time" icon={<Clock weight="fill" />}
            value={minutes ? formatDuration(minutes) : "0m"} sub="last 7 days"
            style={{ "--i": 0 } as React.CSSProperties}
          />
          <MetricCard
            tint="move" label="Volume" icon={<Barbell weight="fill" />}
            value={volume ? count(volume) : "0"} unit="kg" sub="reps by load"
            style={{ "--i": 1 } as React.CSSProperties}
          />
          <MetricCard
            tint="cal" label="Burned" icon={<Fire weight="fill" />}
            value={burned ? kcal(burned) : "0"} unit="kcal" sub="last 7 days"
            style={{ "--i": 2 } as React.CSSProperties}
          />
        </div>

        {sessions.length === 0 ? (
          <Panel>
            <Empty
              illustration={<ArtBarbell />}
              title="No sessions yet"
              hint="On Today, write it how you would say it. Try: bench 4x8 60kg, incline db 3x10 22.5, 15 min treadmill."
              action={
                <Link href="/" className="btn-primary">
                  <ChatCircleDots weight="fill" className="size-[18px]" />
                  Log a session
                </Link>
              }
            />
          </Panel>
        ) : (
          <div className="stagger space-y-4">
            {[...byDay.entries()].map(([day, group], gi) => (
              <Panel key={day} style={{ "--i": gi } as React.CSSProperties}>
                <p className="mb-3.5 text-[13px] font-bold text-[var(--ink-3)]">
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long", day: "numeric", month: "short", timeZone: "UTC",
                  })}
                </p>

                <ul className="space-y-4">
                  {group.map((w) => (
                    <li key={w.id}>
                      <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tint-move)] text-[var(--tint-move-ink)]">
                          <Barbell weight="fill" className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="text-[15px] font-bold leading-snug">{w.title}</h3>
                            <Pill>{KIND_LABEL[w.kind] ?? w.kind}</Pill>
                            <span className="tnum text-[12px] text-[var(--ink-3)]">
                              {timeInTz(w.performedAt, profile.timezone)}
                            </span>
                          </div>
                          <p className="tnum mt-1 text-[13px] text-[var(--ink-2)]">
                            {[
                              w.durationMin ? formatDuration(w.durationMin) : null,
                              w.caloriesBurned ? `${kcal(w.caloriesBurned)} kcal` : null,
                              w.distanceKm ? `${w.distanceKm.toFixed(2)} km` : null,
                              w.totalVolumeKg ? `${count(w.totalVolumeKg)} kg volume` : null,
                            ].filter(Boolean).join("   ·   ")}
                          </p>
                        </div>
                        <DeleteButton endpoint={`/api/workouts/${w.id}`} />
                      </div>

                      {w.exercises && w.exercises.length > 0 && (
                        <ul className="mt-3 space-y-1.5 rounded-2xl bg-[var(--surface-2)] p-3">
                          {w.exercises.map((ex, i) => (
                            <li key={i} className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate text-[13px] font-semibold">{ex.name}</span>
                              <span className="tnum shrink-0 text-[12px] text-[var(--ink-3)]">
                                {(ex.sets ?? [])
                                  .map((st) =>
                                    st.reps && st.weightKg ? `${st.reps}×${st.weightKg}kg`
                                    : st.reps ? `${st.reps} reps`
                                    : st.distanceKm ? `${st.distanceKm} km`
                                    : st.durationMin ? `${st.durationMin} min` : "",
                                  )
                                  .filter(Boolean).join(", ") || (ex.volumeKg ? `${count(ex.volumeKg)} kg` : "logged")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {w.aiNotes && (
                        <p className="mt-2.5 flex gap-1.5 text-[12px] leading-relaxed text-[var(--ink-3)]">
                          <Sparkle weight="fill" className="mt-0.5 size-3 shrink-0 text-[var(--brand)]" />
                          <span>{w.aiNotes}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
