import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChatCircleDots, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth";
import { getDaySummary } from "@/lib/stats";
import { timeInTz, todayKey } from "@/lib/dates";
import { kcal } from "@/lib/format";
import { Empty, Panel, PageTitle, Pill, Ring } from "@/components/ui";
import { MacroSplit, MEAL_ICON, MEAL_TINT } from "@/components/macro-split";
import { DayPicker } from "@/components/day-picker";
import { ArtPlate } from "@/components/art";
import { DeleteButton } from "@/components/loggers";

export const metadata: Metadata = { title: "Food" };
export const dynamic = "force-dynamic";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const { day } = await searchParams;
  const s = await getDaySummary(user.id, day);
  const t = s.targets;
  const left = t.calories != null ? t.calories - s.totals.calories : null;

  const groups = MEAL_ORDER.map((type) => ({
    type,
    meals: s.meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0);

  return (
    <main className="min-w-0 flex-1 px-5 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Food" subtitle="Everything you logged, by meal." />

        <div className="mb-5">
          <Suspense fallback={<div className="skeleton h-[62px] w-full" />}>
            <DayPicker selected={s.day} today={todayKey(s.tz)} basePath="/food" />
          </Suspense>
        </div>

        <Panel className="rise mb-4">
          <div className="flex items-center gap-5">
            <Ring value={s.totals.calories} target={t.calories} size={118} stroke={10}>
              <p className="stat text-[24px] leading-none">{kcal(s.totals.calories)}</p>
              <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">kcal</p>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="label">{left == null ? "No target yet" : left < 0 ? "Over budget" : "Still available"}</p>
              <p
                className="stat mt-1 text-[30px] leading-none"
                style={{ color: left != null && left < 0 ? "var(--critical)" : "var(--ink)" }}
              >
                {left == null ? "Set up" : kcal(Math.abs(left))}
                {left != null && <span className="ml-1.5 text-[13px] font-semibold text-[var(--ink-3)]">kcal</span>}
              </p>
              <p className="mt-2 text-[13px] text-[var(--ink-3)]">
                {t.calories ? `Target ${kcal(t.calories)} kcal` : (
                  <Link href="/you" className="font-semibold text-[var(--brand)]">Finish your profile</Link>
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--hairline)] pt-5">
            <MacroSplit
              calories={s.totals.calories}
              proteinG={s.totals.proteinG}
              carbsG={s.totals.carbsG}
              fatG={s.totals.fatG}
            />
          </div>

          {(s.totals.fiberG > 0 || s.totals.sodiumMg > 0) && (
            <p className="mt-5 border-t border-[var(--hairline)] pt-4 text-[12px] text-[var(--ink-3)]">
              Fibre {Math.round(s.totals.fiberG)} g &middot; Sugar {Math.round(s.totals.sugarG)} g &middot; Sodium{" "}
              {Math.round(s.totals.sodiumMg)} mg
            </p>
          )}
        </Panel>

        {groups.length === 0 ? (
          <Panel>
            <Empty
              illustration={<ArtPlate />}
              title="Nothing logged for this day"
              hint="Head to Today and just say what you ate. No forms, no searching."
              action={
                <Link href="/" className="btn-primary">
                  <ChatCircleDots weight="fill" className="size-[18px]" />
                  Log something
                </Link>
              }
            />
          </Panel>
        ) : (
          <div className="stagger space-y-4">
            {groups.map((group, gi) => (
              <Panel key={group.type} style={{ "--i": gi } as React.CSSProperties}>
                <div className="mb-3.5 flex items-center gap-2.5">
                  {(() => {
                    const Icon = MEAL_ICON[group.type];
                    return (
                      <span
                        className="grid size-8 place-items-center rounded-full"
                        style={{ background: `var(--tint-${MEAL_TINT[group.type]})`, color: `var(--tint-${MEAL_TINT[group.type]}-ink)` }}
                      >
                        <Icon weight="fill" className="size-4" />
                      </span>
                    );
                  })()}
                  <h2 className="text-[17px] font-bold tracking-[-0.02em]">{MEAL_LABEL[group.type]}</h2>
                  <span className="tnum ml-auto text-[13px] font-semibold text-[var(--ink-3)]">
                    {kcal(group.meals.reduce((a, m) => a + m.calories, 0))} kcal
                  </span>
                </div>
                <ul className="divide-y divide-[var(--hairline)]">
                  {group.meals.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                      {m.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/photos/${m.imageUrl}`}
                          alt=""
                          className="size-14 shrink-0 rounded-2xl border border-[var(--hairline)] object-cover"
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="text-[15px] font-bold leading-snug">{m.name}</h3>
                          <span className="tnum text-[12px] text-[var(--ink-3)]">{timeInTz(m.eatenAt, s.tz)}</span>
                          {m.confidence != null && m.confidence < 0.55 && <Pill tone="warning">rough estimate</Pill>}
                        </div>

                        <div className="mt-2">
                          <MacroSplit
                            size="sm"
                            calories={m.calories}
                            proteinG={m.proteinG}
                            carbsG={m.carbsG}
                            fatG={m.fatG}
                          />
                        </div>

                        {m.items && m.items.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--brand)]">
                              {m.items.length} item{m.items.length > 1 ? "s" : ""}
                            </summary>
                            <ul className="mt-2 space-y-1.5 rounded-2xl bg-[var(--surface-2)] p-3">
                              {m.items.map((it, i) => (
                                <li key={i} className="tnum flex items-baseline justify-between gap-3 text-[12px]">
                                  <span className="min-w-0 truncate text-[var(--ink-2)]">
                                    {it.name}
                                    {it.quantity && <span className="text-[var(--ink-3)]"> &middot; {it.quantity}</span>}
                                  </span>
                                  <span className="shrink-0 font-bold">{kcal(it.calories)}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        {m.aiNotes && (
                          <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-[var(--ink-3)]">
                            <Sparkle weight="fill" className="mt-0.5 size-3 shrink-0 text-[var(--brand)]" />
                            <span>{m.aiNotes}</span>
                          </p>
                        )}
                      </div>

                      <DeleteButton endpoint={`/api/food/${m.id}`} />
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
