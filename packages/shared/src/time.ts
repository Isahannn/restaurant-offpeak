// Constructing Intl.DateTimeFormat is expensive (~0.1 ms); formatting with an
// existing one is cheap. Slot lists call this hundreds of times per request.
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instant));

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Slots store a calendar date (UTC midnight, from a Postgres DATE column) plus a
 * local "HH:MM" start time. This returns the real instant that wall-clock time
 * refers to in the restaurant's time zone.
 */
export function slotStartInstant(slotDate: Date, startTime: string, timeZone: string): Date {
  const [hours, minutes] = startTime.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(
    slotDate.getUTCFullYear(),
    slotDate.getUTCMonth(),
    slotDate.getUTCDate(),
    hours,
    minutes,
  );

  // Two passes: the second corrects the offset when the first guess lands on
  // the other side of a DST transition.
  let instant = wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, timeZone);
  instant = wallClockAsUtc - timeZoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

/** Calendar date ("YYYY-MM-DD") that `instant` falls on in `timeZone`. */
export function localDateString(instant: Date, timeZone: string): string {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    // en-CA formats dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}
