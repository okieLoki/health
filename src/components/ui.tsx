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

export function Ring({
  value,
  target,
  size = 150,
  stroke = 11,
  color = "var(--brand)",
  children,
}: {
  value: number;
  target: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = target ? Math.min(1, value / target) : 0;
  const over = target ? value > target : false;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--critical)" : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Empty({
  illustration,
  title,
  hint,
  action,
}: {
  illustration?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {illustration}
      <p className="text-[16px] font-bold">{title}</p>
      {hint && <p className="max-w-xs text-[14px] leading-relaxed text-[var(--ink-3)]">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warning" | "critical" | "brand";
}) {
  const map = {
    default: "bg-[var(--surface-2)] text-[var(--ink-2)]",
    good: "bg-[var(--good)]/12 text-[var(--good)]",
    warning: "bg-[var(--warning)]/15 text-[#8a6100] dark:text-[var(--warning)]",
    critical: "bg-[var(--critical)]/12 text-[var(--critical)]",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

/** Tappable row, the main way to drill from a summary into detail. */
export function Row({
  icon,
  title,
  detail,
  value,
  valueSub,
  trailing,
}: {
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  valueSub?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--ink-2)]">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-snug">{title}</p>
        {detail && <p className="truncate text-[13px] text-[var(--ink-3)]">{detail}</p>}
      </div>
      {value != null && (
        <div className="shrink-0 text-right">
          <p className="tnum text-[15px] font-bold">{value}</p>
          {valueSub && <p className="text-[12px] text-[var(--ink-3)]">{valueSub}</p>}
        </div>
      )}
      {trailing}
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-[var(--hairline)]" />;
}
