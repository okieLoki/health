import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reportRuns, users } from "@/db/schema";
import { todayKey } from "./dates";
import { coachNote } from "./gemini";
import { appUrl, sendReportEmail } from "./email";
import { buildReport } from "./report";
import { getDaySummary, getTrend, trendRate } from "./stats";

/** Builds and sends one user's daily report. Records the attempt either way. */
export async function sendDailyReport(userId: string, opts: { day?: string; force?: boolean } = {}) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("User not found");

  const summary = await getDaySummary(userId, opts.day);
  const day = summary.day;

  if (!opts.force) {
    const already = await db.query.reportRuns.findFirst({
      where: (r, { and, eq: e }) => and(e(r.userId, userId), e(r.day, day)),
    });
    if (already?.status === "sent") return { status: "skipped" as const, day, reason: "already sent" };
  }

  const trend = await getTrend(userId, 30);
  const rate = trendRate(trend);
  const t = summary.targets;

  // Give the model only numbers, so its paragraph can't drift from the data.
  const note = await coachNote(
    [
      `Day: ${day}. Timezone ${summary.tz}.`,
      `Calories eaten ${Math.round(summary.totals.calories)} against a target of ${t.calories ?? "unknown"}.`,
      `Estimated burn ${summary.burned ?? "unknown"}. Net ${summary.netKcal ?? "unknown"} kcal.`,
      `Protein ${Math.round(summary.totals.proteinG)}g of ${t.proteinG ?? "?"}g.`,
      `Weight ${summary.latestWeight?.weightKg ?? "unknown"} kg, 7-day trend ${rate ?? "unknown"} kg/week, goal ${summary.profile.goal} at ${summary.profile.weeklyRateKg} kg/week.`,
      `Steps ${summary.health?.steps ?? "unknown"} of ${summary.profile.stepTarget}.`,
      `Water ${summary.waterMl}ml of ${summary.profile.waterTargetMl}ml.`,
      `Fasting ${summary.fasting.hours?.toFixed(1) ?? "unknown"} hours since last meal, target ${summary.fasting.targetHours}h.`,
      `Training today: ${summary.workouts.map((w) => w.title).join(", ") || "none"}.`,
      `Meals: ${summary.meals.map((m) => m.name).join(", ") || "none logged"}.`,
    ].join("\n"),
  );

  const { subject, html, text } = buildReport({
    summary,
    trend,
    rateKgPerWeek: rate,
    coachNote: note,
    appUrl: appUrl(),
    name: user.name,
  });

  try {
    const id = await sendReportEmail({ to: user.email, subject, html, text });
    await db
      .insert(reportRuns)
      .values({ userId, day, status: "sent", detail: id })
      .onConflictDoUpdate({
        target: [reportRuns.userId, reportRuns.day],
        set: { status: "sent", detail: id, sentAt: new Date() },
      });
    return { status: "sent" as const, day, to: user.email, id };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await db
      .insert(reportRuns)
      .values({ userId, day, status: "failed", detail })
      .onConflictDoUpdate({
        target: [reportRuns.userId, reportRuns.day],
        set: { status: "failed", detail, sentAt: new Date() },
      });
    throw err;
  }
}

export { todayKey };
