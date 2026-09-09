import { BowlFood, Cookie, Egg, ForkKnife } from "@phosphor-icons/react/dist/ssr";

export const MEAL_ICON = {
  breakfast: Egg,
  lunch: BowlFood,
  dinner: ForkKnife,
  snack: Cookie,
} as const;

export const MEAL_TINT = {
  breakfast: "time",
  lunch: "move",
  dinner: "cal",
  snack: "body",
} as const;

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

/**
 * Where a meal's energy actually came from. A stacked bar by calorie share
 * says "this was mostly carbs" instantly, which a row of gram counts never
 * does. Each segment is direct-labelled below, so colour is never the only cue.
 */
export function MacroSplit({
  calories,
  proteinG,
  carbsG,
  fatG,
  size = "md",
}: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  size?: "sm" | "md";
}) {
  const kcal = {
    protein: proteinG * KCAL_PER_G.protein,
    carbs: carbsG * KCAL_PER_G.carbs,
    fat: fatG * KCAL_PER_G.fat,
  };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  const parts = [
    { key: "protein", label: "Protein", grams: proteinG, pct: share(kcal.protein), color: "var(--series-1)" },
    { key: "carbs", label: "Carbs", grams: carbsG, pct: share(kcal.carbs), color: "var(--series-2)" },
    { key: "fat", label: "Fat", grams: fatG, pct: share(kcal.fat), color: "var(--series-3)" },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className={`stat ${size === "sm" ? "text-[19px]" : "text-[23px]"} leading-none`}>
          {Math.round(calories).toLocaleString("en-US")}
        </span>
        <span className="text-[12px] font-semibold text-[var(--ink-3)]">kcal</span>
      </div>

      {/* 2px gaps between segments keep adjacent fills legible. */}
      <div className="mt-2.5 flex h-[7px] gap-[2px] overflow-hidden rounded-full">
        {total > 0 ? (
          parts.map((p) => (
            <span
              key={p.key}
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${p.pct}%`, background: p.color, minWidth: p.pct > 0 ? 3 : 0 }}
            />
          ))
        ) : (
          <span className="h-full w-full rounded-full bg-[var(--surface-3)]" />
        )}
      </div>

      <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-1.5">
            <span className="size-[7px] shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <dt className="text-[12px] text-[var(--ink-3)]">{p.label}</dt>
            <dd className="tnum text-[12px] font-bold">
              {Math.round(p.grams)}g
              {total > 0 && <span className="ml-1 font-medium text-[var(--ink-3)]">{Math.round(p.pct)}%</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
