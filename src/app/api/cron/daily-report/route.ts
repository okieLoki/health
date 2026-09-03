import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { ok } from "@/lib/api";
import { emailConfigured } from "@/lib/email";
import { sendDailyReport } from "@/lib/send-report";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron hits this once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Each enabled user gets their own
 * local-calendar day's report; the unique (user, day) row makes a retry safe.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return ok({ error: "Unauthorized" }, 401);
  }
  if (!emailConfigured()) return ok({ error: "RESEND_API_KEY is not set" }, 503);

  const enabled = await db.select().from(profiles).where(eq(profiles.reportEnabled, "true"));

  const results = await Promise.allSettled(
    enabled.map((p) => sendDailyReport(p.userId)),
  );

  return ok({
    ran: results.length,
    sent: results.filter((r) => r.status === "fulfilled" && r.value.status === "sent").length,
    skipped: results.filter((r) => r.status === "fulfilled" && r.value.status === "skipped").length,
    failed: results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason).slice(0, 200)),
  });
}
