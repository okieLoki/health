import type { ReactNode } from "react";

/** The only container. Generous padding, soft corners, one idea inside. */
export function Panel({
  children,
  className = "",
  as: Tag = "section",
  flush = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  flush?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <Tag
      style={style}
      className={`rounded-[26px] border border-[var(--hairline)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${
        flush ? "" : "p-5"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] lg:text-[34px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[15px] leading-snug text-[var(--ink-2)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-3)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: "default" | "good" | "warning" | "critical" | "brand";
  size?: "md" | "lg";
}) {
  const color = {
    default: "var(--ink)",
    good: "var(--good)",
    warning: "var(--warning)",
    critical: "var(--critical)",
    brand: "var(--brand)",
  }[tone];

  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p
        className={`stat mt-1.5 leading-none ${size === "lg" ? "text-[34px]" : "text-[26px]"}`}
        style={{ color }}
      >
        {value}
        {unit && <span className="ml-1 text-[13px] font-semibold text-[var(--ink-3)]">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 truncate text-[12px] text-[var(--ink-3)]">{sub}</p>}
    </div>
  );
}

/** Labelled bar. The label is what keeps colour from carrying meaning alone. */
export function Meter({
  label,
  value,
  target,
  unit = "",
  color = "var(--series-1)",
}: {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
  color?: string;
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target ? value > target : false;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="tnum text-[13px] text-[var(--ink-3)]">
          <span className="font-bold text-[var(--ink)]">{Math.round(value)}</span>
          {target != null ? ` / ${Math.round(target)}${unit}` : unit}
        </span>
      </div>
      <div
        className="h-[7px] w-full overflow-hidden rounded-full bg-[var(--surface-3)]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target ?? undefined}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: over ? "var(--critical)" : color }}
        />
      </div>
    </div>
  );
}
