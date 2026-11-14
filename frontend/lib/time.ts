// Replay times are plain hours with no time zone, exactly as the data service writes them
// ("2015-11-01T00:00:00"). All arithmetic is done in UTC so the browser's zone never matters.

const HOUR_MS = 3_600_000;
const AT_FORM = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):00(?::00)?$/;

/** Parse "YYYY-MM-DDTHH:00[:00]" into hours since the Unix epoch, or null if it is not a whole valid hour. */
export function parseHour(text: string): number | null {
  const m = AT_FORM.exec(text);
  if (!m) return null;
  const [y, mo, d, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  const ms = Date.UTC(y, mo - 1, d, h);
  const back = new Date(ms);
  // Rejects things like 2015-02-30 or hour 24, which Date.UTC would silently roll over.
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h
  ) {
    return null;
  }
  return ms / HOUR_MS;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Hours since the Unix epoch -> "YYYY-MM-DDTHH:00" (the form kept in the web address). */
export function formatHour(hours: number): string {
  const d = new Date(hours * HOUR_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
}

const READABLE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "1 Nov 2015, 00:00" (the ends of the replay timeline). */
export function shortHour(hours: number): string {
  return SHORT.format(new Date(hours * HOUR_MS));
}

/** "14 November 2015, 06:00" (shown as the replay time and spoken by screen readers). */
export function readableHour(hours: number): string {
  const part = (type: string) => READABLE.formatToParts(new Date(hours * HOUR_MS)).find((p) => p.type === type)?.value;
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}
