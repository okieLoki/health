import { Resend } from "resend";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

let client: Resend | null = null;
function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  client ??= new Resend(key);
  return client;
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function sendReportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const from = process.env.REPORT_FROM ?? "Cut <onboarding@resend.dev>";
  const { data, error } = await resend().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
  return data?.id ?? null;
}
