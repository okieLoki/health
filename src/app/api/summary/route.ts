import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { getDaySummary, getTrend, trendRate } from "@/lib/stats";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const day = params.get("day") ?? undefined;
    const days = Math.min(Number(params.get("days") ?? 30), 365);

    const [summary, trend] = await Promise.all([
      getDaySummary(user.id, day),
      getTrend(user.id, days),
    ]);

    return ok({ summary, trend, rateKgPerWeek: trendRate(trend) });
  } catch (e) {
    return apiError(e);
  }
}
