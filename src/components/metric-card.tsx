import Link from "next/link";
import type { ReactNode } from "react";

type Tint = "cal" | "water" | "body" | "move" | "time";

/**
 * A tinted metric tile. Each metric owns a hue so the grid is learnable at a
 * glance; the hue is decoration, never an encoding, so the label always carries
 * the meaning on its own.
 */
export function MetricCard({
  href,
  tint,
  icon,
  label,
  value,
  unit,
  sub,
  spark,
  className = "",
  style,
}: {
  href?: string;
  tint: Tint;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  spark?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-1.5">
        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--ink-2)]">{label}</span>
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface)]/70 [&>svg]:size-[15px]"
          style={{ color: `var(--tint-${tint}-ink)` }}
        >
          {icon}
        </span>
      </div>

      {/* Three of these sit side by side on a 412px phone, so the numerals
          step down rather than spilling out of the tile. */}
      <p className="stat mt-3 truncate text-[22px] leading-none sm:text-[28px]">
        {value}
        {unit && <span className="ml-1 text-[12px] font-semibold text-[var(--ink-3)] sm:text-[13px]">{unit}</span>}
      </p>

      {sub && <p className="mt-1.5 truncate text-[12px] text-[var(--ink-3)]">{sub}</p>}
      {spark && <div className="mt-3 h-8">{spark}</div>}
    </>
  );

  const classes = `block min-w-0 rounded-[24px] p-3.5 transition-transform duration-200 active:scale-[0.98] sm:p-4 ${className}`;
  const styles = { background: `var(--tint-${tint})`, ...style };

  return href ? (
    <Link href={href} className={classes} style={styles}>
      {body}
    </Link>
  ) : (
    <div className={classes} style={styles}>
      {body}
    </div>
  );
}

/** Tiny bar sparkline. Decorative scale, so no axis and no tooltip. */
export function Spark({ values, tint }: { values: (number | null)[]; tint: Tint }) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(1, ...nums);
  return (
    <div className="flex h-full items-end gap-[3px]" aria-hidden="true">
      {nums.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-full"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: `var(--tint-${tint}-ink)`,
            opacity: v === 0 ? 0.18 : 0.3 + (v / max) * 0.7,
          }}
        />
      ))}
    </div>
  );
}
