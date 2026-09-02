import { formatDuration, timeInTz } from "./dates";
import type { DaySummary, TrendPoint } from "./stats";

/**
 * Email HTML has to survive Gmail and Apple Mail: tables, inline styles, no
 * external assets, no JS. Bars are table cells with a percentage width, which
 * is the one charting technique that renders everywhere.
 */

const C = {
  bg: "#f4f3ef",
  card: "#ffffff",
  border: "#e4e2da",
  text: "#0b0b0b",
  sub: "#52514e",
  muted: "#86847c",
  accent: "#2a78d6",
  s1: "#2a78d6",
  s2: "#eb6834",
  s3: "#1baf7a",
  good: "#0ca30c",
  warn: "#fab219",
  crit: "#d03b3b",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const n0 = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("en-US"));
const n1 = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(1));

function bar(pct: number, color: string): string {
  const w = Math.max(0, Math.min(100, Math.round(pct)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${C.bg};border-radius:99px;height:8px;">
<tr><td width="${w}%" style="background:${color};border-radius:99px;height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function row(label: string, value: string, sub?: string): string {
  return `<tr>
<td style="padding:9px 0;border-bottom:1px solid ${C.border};color:${C.sub};font-size:14px;">${esc(label)}</td>
<td align="right" style="padding:9px 0;border-bottom:1px solid ${C.border};color:${C.text};font-size:14px;font-weight:600;">${value}${
    sub ? `<span style="color:${C.muted};font-weight:400;font-size:12px;"> ${esc(sub)}</span>` : ""
  }</td></tr>`;
}

function card(title: string, inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:14px;margin-bottom:14px;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.muted};">${esc(title)}</p>
${inner}
</td></tr></table>`;
}

export type ReportInput = {
  summary: DaySummary;
  trend: TrendPoint[];
  rateKgPerWeek: number | null;
  coachNote: string | null;
  appUrl: string;
  name: string | null;
};

export function buildReport(input: ReportInput): { subject: string; html: string; text: string } {
  const { summary: s, trend, rateKgPerWeek, coachNote, appUrl } = input;
  const t = s.targets;
  const tz = s.tz;

  const dateLabel = new Date(`${s.day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const calPct = t.calories ? (s.totals.calories / t.calories) * 100 : 0;
  const net = s.netKcal;
  const netLabel = net == null ? "-" : net < 0 ? `${n0(Math.abs(net))} deficit` : `${n0(net)} surplus`;
  const netColor = net == null ? C.muted : net < 0 ? C.good : C.crit;

  // ---- hero -------------------------------------------------------------
  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:14px;margin-bottom:14px;">
<tr><td style="padding:22px 20px;">
<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${C.muted};">Energy balance</p>
<p style="margin:0 0 2px;font-size:34px;font-weight:700;color:${netColor};letter-spacing:-.02em;">${netLabel}</p>
<p style="margin:0 0 16px;color:${C.sub};font-size:13px;">${n0(s.totals.calories)} eaten &middot; ${n0(s.burned)} burned${
    t.tdeeBasis === "measured" ? " (from your Watch)" : ""
  }</p>
${bar(calPct, calPct > 105 ? C.crit : C.s1)}
<p style="margin:8px 0 0;color:${C.muted};font-size:12px;">${n0(s.totals.calories)} of ${n0(t.calories)} kcal target &middot; ${Math.round(calPct)}%</p>
</td></tr></table>`;

  // ---- macros -----------------------------------------------------------
  const macro = (label: string, got: number, target: number | null, color: string) => `
<p style="margin:0 0 5px;font-size:13px;color:${C.text};"><strong>${esc(label)}</strong> <span style="color:${C.muted};">${n0(got)} / ${n0(target)} g</span></p>
${bar(target ? (got / target) * 100 : 0, color)}`;

  const macros = card(
    "Macros",
    `${macro("Protein", s.totals.proteinG, t.proteinG, C.s1)}
<div style="height:12px;"></div>
${macro("Carbs", s.totals.carbsG, t.carbsG, C.s2)}
<div style="height:12px;"></div>
${macro("Fat", s.totals.fatG, t.fatG, C.s3)}`,
  );

  // ---- meals ------------------------------------------------------------
  const meals = s.meals.length
    ? card(
        `Food · ${s.meals.length} ${s.meals.length === 1 ? "entry" : "entries"}`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.meals
          .map((m) =>
            row(
              `${timeInTz(m.eatenAt, tz)} · ${m.name}`,
              `${n0(m.calories)} kcal`,
              `P${Math.round(m.proteinG)} C${Math.round(m.carbsG)} F${Math.round(m.fatG)}`,
            ),
          )
          .join("")}</table>`,
      )
    : card("Food", `<p style="margin:0;color:${C.muted};font-size:14px;">Nothing logged today.</p>`);

  // ---- body / movement --------------------------------------------------
  const stepPct = s.profile.stepTarget ? ((s.health?.steps ?? 0) / s.profile.stepTarget) * 100 : 0;
  const waterPct = s.profile.waterTargetMl ? (s.waterMl / s.profile.waterTargetMl) * 100 : 0;

  const body = card(
    "Body & movement",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Weight", s.latestWeight ? `${n1(s.latestWeight.weightKg)} kg` : "-", s.dayWeights.length > 1 ? `${s.dayWeights.length} readings` : undefined)}
${row("7-day trend", rateKgPerWeek == null ? "-" : `${rateKgPerWeek > 0 ? "+" : ""}${n1(rateKgPerWeek)} kg/wk`)}
${t.bmi ? row("BMI", n1(t.bmi)) : ""}
${row("Steps", n0(s.health?.steps), s.profile.stepTarget ? `of ${n0(s.profile.stepTarget)}` : undefined)}
${s.health?.exerciseMin ? row("Exercise", formatDuration(s.health.exerciseMin)) : ""}
${s.health?.sleepMin ? row("Sleep", formatDuration(s.health.sleepMin)) : ""}
${s.health?.restingHr ? row("Resting HR", `${n0(s.health.restingHr)} bpm`) : ""}
</table>
<div style="height:14px;"></div>
${bar(stepPct, C.s3)}
<p style="margin:6px 0 0;color:${C.muted};font-size:12px;">Steps ${Math.round(stepPct)}% of target</p>`,
  );

  // ---- training ---------------------------------------------------------
  const training = s.workouts.length
    ? card(
        "Training",
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.workouts
          .map((w) =>
            row(
              `${timeInTz(w.performedAt, tz)} · ${w.title}`,
              w.caloriesBurned ? `${n0(w.caloriesBurned)} kcal` : "logged",
              [
                w.durationMin ? formatDuration(w.durationMin) : null,
                w.totalVolumeKg ? `${n0(w.totalVolumeKg)} kg volume` : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
            ),
          )
          .join("")}</table>`,
      )
    : "";

  // ---- water & fasting --------------------------------------------------
  const fastLine = s.fasting.hours != null ? `${n1(s.fasting.hours)} h since last meal` : "-";
  const windowLine =
    s.fasting.eatingWindowHours != null
      ? `${n1(s.fasting.eatingWindowHours)} h eating window`
      : "no meals logged";

  const habits = card(
    "Water & fasting",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Water", `${(s.waterMl / 1000).toFixed(2)} L`, `of ${(s.profile.waterTargetMl / 1000).toFixed(1)} L`)}
${row("Fasting", fastLine, `target ${n0(s.fasting.targetHours)} h`)}
${row("Eating window", windowLine, s.fasting.firstMeal && s.fasting.lastMeal ? `${timeInTz(s.fasting.firstMeal, tz)} – ${timeInTz(s.fasting.lastMeal, tz)}` : undefined)}
</table>
<div style="height:14px;"></div>
${bar(waterPct, C.s1)}
<p style="margin:6px 0 0;color:${C.muted};font-size:12px;">Water ${Math.round(waterPct)}% of target</p>`,
  );

  // ---- 14-day calorie strip --------------------------------------------
  const recent = trend.slice(-14);
  const maxCal = Math.max(1, ...recent.map((p) => Math.max(p.calories ?? 0, p.burned ?? 0)));
  const strip = card(
    "Last 14 days",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
<tr>${recent
      .map((p) => {
        const h = Math.round(((p.calories ?? 0) / maxCal) * 48);
        const over = p.burned != null && (p.calories ?? 0) > p.burned;
        return `<td valign="bottom" align="center" style="height:52px;padding:0 1px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${Math.max(h, 2)}px;background:${
          over ? C.s2 : C.s1
        };border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`;
      })
      .join("")}</tr>
<tr>${recent
      .map((p) => `<td align="center" style="padding-top:5px;font-size:9px;color:${C.muted};">${p.day.slice(8)}</td>`)
      .join("")}</tr>
</table>
<p style="margin:10px 0 0;color:${C.muted};font-size:12px;">
<span style="color:${C.s1};">&#9632;</span> at or under burn &nbsp;
<span style="color:${C.s2};">&#9632;</span> over burn</p>`,
  );

  const coach = coachNote
    ? card("Coach", `<p style="margin:0;color:${C.text};font-size:14px;line-height:1.6;">${esc(coachNote)}</p>`)
    : "";

  const missing = t.missing.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7e6;border:1px solid ${C.warn};border-radius:12px;margin-bottom:14px;">
<tr><td style="padding:14px 18px;color:#6b4d00;font-size:13px;">
Targets are incomplete, add ${esc(t.missing.join(", "))} in your profile to get a real calorie target.
</td></tr></table>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily report</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${netLabel} · ${n0(s.totals.calories)} kcal eaten · ${n0(s.health?.steps)} steps</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:0 4px 18px;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.accent};">Cut &middot; daily report</p>
<h1 style="margin:6px 0 0;font-size:24px;font-weight:700;color:${C.text};letter-spacing:-.02em;">${esc(dateLabel)}</h1>
</td></tr>
<tr><td>
${missing}${hero}${macros}${meals}${training}${body}${habits}${strip}${coach}
<p style="margin:18px 0 0;text-align:center;">
<a href="${esc(appUrl)}" style="display:inline-block;background:${C.accent};color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:14px;font-weight:600;">Open Cut</a>
</p>
<p style="margin:16px 0 0;text-align:center;color:${C.muted};font-size:11px;line-height:1.5;">
Estimates, not medical advice. Turn this report off in your profile.
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    `Cut, ${dateLabel}`,
    ``,
    `Energy: ${netLabel}`,
    `Eaten ${n0(s.totals.calories)} / target ${n0(t.calories)} kcal · burned ${n0(s.burned)}`,
    `Protein ${n0(s.totals.proteinG)}/${n0(t.proteinG)}g · Carbs ${n0(s.totals.carbsG)}/${n0(t.carbsG)}g · Fat ${n0(s.totals.fatG)}/${n0(t.fatG)}g`,
    ``,
    `Weight: ${s.latestWeight ? `${n1(s.latestWeight.weightKg)} kg` : "-"} (trend ${rateKgPerWeek == null ? "-" : `${n1(rateKgPerWeek)} kg/wk`})`,
    `Steps: ${n0(s.health?.steps)} / ${n0(s.profile.stepTarget)}`,
    `Water: ${(s.waterMl / 1000).toFixed(2)} L / ${(s.profile.waterTargetMl / 1000).toFixed(1)} L`,
    `Fasting: ${fastLine} · ${windowLine}`,
    ``,
    s.workouts.length ? `Training: ${s.workouts.map((w) => w.title).join(", ")}` : `Training: none logged`,
    ``,
    coachNote ?? "",
    ``,
    appUrl,
  ].join("\n");

  const subject = `${netLabel} · ${n0(s.totals.calories)} kcal · ${dateLabel.split(",")[0]}`;

  return { subject, html, text };
}
