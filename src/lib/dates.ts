import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** "2026-09-17" for the instant `d` as seen in `tz`. */
export function dayKey(d: Date, tz: string): string {
  return format(new TZDate(d, tz), "yyyy-MM-dd");
}

export function todayKey(tz: string): string {
  return dayKey(new Date(), tz);
}

/** The UTC instants bounding a local calendar day. */
export function dayRange(key: string, tz: string): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number);
  return {
    start: new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, tz).getTime()),
    end: new Date(new TZDate(y, m - 1, d, 23, 59, 59, 999, tz).getTime()),
  };
}

/** Day keys for the last `n` days in `tz`, oldest first, ending today. */
export function lastNDayKeys(n: number, tz: string, endKey?: string): string[] {
  const end = endKey ?? todayKey(tz);
  const [y, m, d] = end.split("-").map(Number);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    keys.push(format(dt, "yyyy-MM-dd"));
  }
  return keys;
}

export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return format(new Date(Date.UTC(y, m - 1, d + days)), "yyyy-MM-dd");
}

/** "7:42 pm" in the user's zone. */
export function timeInTz(d: Date, tz: string): string {
  return format(new TZDate(d, tz), "h:mm a");
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "2026-09-17T21:30" as wall-clock time in `tz`, converted to a real instant. */
export function localToUtc(local: string, tz: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const dt = new TZDate(y, mo - 1, d, h, mi, 0, 0, tz);
  const out = new Date(dt.getTime());
  return Number.isNaN(out.getTime()) ? null : out;
}

/** "Wednesday, 17 September 2026, 12:35 am", context for the model. */
export function localContext(tz: string): string {
  const now = new TZDate(new Date(), tz);
  return format(now, "EEEE, d MMMM yyyy, h:mm a");
}
