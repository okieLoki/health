import { requireUser } from "@/lib/auth";
import { apiError, ok } from "@/lib/api";
import { emailConfigured } from "@/lib/email";
import { sendDailyReport } from "@/lib/send-report";

export const runtime = "nodejs";
export const maxDuration = 60;

/** "Send me today's report now" from the profile page. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!emailConfigured()) {
      return ok({ error: "Resend isn't configured, set RESEND_API_KEY." }, 503);
    }
    const day = new URL(req.url).searchParams.get("day") ?? undefined;
    const result = await sendDailyReport(user.id, { day, force: true });
    return ok(result);
  } catch (e) {
    return apiError(e);
  }
}
