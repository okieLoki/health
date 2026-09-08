"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLine, Table } from "@phosphor-icons/react";

const AXIS = { fill: "var(--ink-3)", fontSize: 11 } as const;
const GRID = "var(--grid)";

function shortDay(day: string) {
  return `${day.slice(8)}/${day.slice(5, 7)}`;
}

/** Frame with the legend, and a toggle to read the same data as a table. */
export function ChartFrame({
  title,
  hint,
  legend,
  table,
  children,
  height = 240,
}: {
  title: string;
  hint?: string;
  legend?: { label: string; color: string; shape?: "line" | "square" | "dot" }[];
  table: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="rounded-[26px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-[13px] text-[var(--ink-3)]">{hint}</p>}
        </div>
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="btn-ghost shrink-0 !px-2 !py-1.5"
          title={view === "chart" ? "Show as table" : "Show chart"}
          aria-label={view === "chart" ? "Show as table" : "Show chart"}
        >
          {view === "chart" ? <Table weight="bold" className="size-4" /> : <ChartLine weight="bold" className="size-4" />}
        </button>
      </div>

      {legend && legend.length > 0 && (
        <ul className="mb-3 mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
              <span
                aria-hidden
                style={{ background: l.color }}
                className={
                  l.shape === "line"
                    ? "inline-block h-0.5 w-4 rounded-full"
                    : l.shape === "dot"
                      ? "inline-block size-2 rounded-full"
                      : "inline-block size-2.5 rounded-[2px]"
                }
              />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      {view === "chart" ? (
        <div style={{ height }} className="-ml-2">
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[260px] overflow-auto rounded-lg border border-[var(--hairline)]">
          {table}
        </div>
      )}
    </section>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-[var(--surface)]">
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              className={`px-3 py-2 font-semibold text-[var(--ink-2)] ${i > 0 ? "text-right" : ""}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--hairline)]">
            {r.map((cell, j) => (
              <td key={j} className={`tnum px-3 py-1.5 ${j > 0 ? "text-right" : ""}`}>
                {cell ?? "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type TipRow = { label: string; value: string; color?: string };
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold text-[var(--ink-2)]">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="tnum flex items-center gap-2 text-xs">
          {r.color && <span className="inline-block size-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-[var(--ink-2)]">{r.label}</span>
          <span className="ml-auto font-semibold">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export type Point = {
  day: string;
  weightKg: number | null;
  weightTrendKg: number | null;
  calories: number | null;
  burned: number | null;
  net: number | null;
  steps: number | null;
  waterMl: number | null;
};

/* ------------------------------------------------------------------ weight */

export function WeightChart({ data, goalKg }: { data: Point[]; goalKg?: number | null }) {
  const points = data.filter((d) => d.weightKg != null || d.weightTrendKg != null);
  const values = points.flatMap((d) => [d.weightKg, d.weightTrendKg].filter((v): v is number => v != null));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = Math.max(0.5, (max - min) * 0.25);

  return (
    <ChartFrame
      title="Weight"
      hint="Daily readings with a 7-day average, judge progress by the line, not the dots."
      height={250}
      legend={[
        { label: "Reading", color: "var(--series-1)", shape: "dot" },
        { label: "7-day average", color: "var(--series-2)", shape: "line" },
        ...(goalKg ? [{ label: "Goal", color: "var(--ink-3)", shape: "line" as const }] : []),
      ]}
      table={
        <DataTable
          columns={["Day", "Reading (kg)", "7-day avg"]}
          rows={points.map((d) => [d.day, d.weightKg?.toFixed(1) ?? null, d.weightTrendKg?.toFixed(1) ?? null])}
        />
      }
    >
      <ComposedChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={38}
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip
          cursor={{ stroke: "var(--hairline-strong)", strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                rows={payload.map((p) => ({
                  label: p.name === "weightKg" ? "Reading" : "7-day avg",
                  value: p.value != null ? `${Number(p.value).toFixed(1)} kg` : "-",
                  color: String(p.color),
                }))}
              />
            ) : null
          }
        />
        {goalKg && (
          <ReferenceLine
            y={goalKg}
            stroke="var(--ink-3)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: "goal", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 10 }}
          />
        )}
        <Scatter dataKey="weightKg" fill="var(--series-1)" shape="circle" />
        <Line
          type="monotone"
          dataKey="weightTrendKg"
          stroke="var(--series-2)"
          strokeWidth={2}
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ChartFrame>
  );
}
