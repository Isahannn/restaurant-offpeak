import { localDateString, slotStartInstant } from "@app/shared";

/** First calendar day (as stored in Slot.date) that can still have bookable slots. */
export function localToday(now: Date, timeZone: string): Date {
  return new Date(`${localDateString(now, timeZone)}T00:00:00.000Z`);
}

/** Keeps only slots that have not started yet — a started slot can no longer be booked. */
export function onlyUpcomingSlots<T extends { date: Date; startTime: string }>(
  slots: T[],
  now: Date,
  timeZone: string,
): T[] {
  const nowMs = now.getTime();
  return slots.filter((slot) => slotStartInstant(slot.date, slot.startTime, timeZone).getTime() > nowMs);
}
