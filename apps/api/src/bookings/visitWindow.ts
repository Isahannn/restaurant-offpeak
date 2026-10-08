import { slotStartInstant } from "@app/shared";

/** Guests often arrive a little early; staff may check them in from this point. */
const ARRIVAL_OPENS_BEFORE_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VisitWindow {
  canMarkArrived: boolean;
  canMarkNoShow: boolean;
}

/**
 * When staff may record a visit. Marks outside real time make no sense (and
 * invite abuse): "arrived" from 30 min before the start until the end of that
 * local day, "no-show" only once the slot has started.
 */
export function visitWindow(slot: { date: Date; startTime: string }, now: Date, timeZone: string): VisitWindow {
  const startMs = slotStartInstant(slot.date, slot.startTime, timeZone).getTime();
  const endOfDayMs = slotStartInstant(new Date(slot.date.getTime() + DAY_MS), "00:00", timeZone).getTime();
  const nowMs = now.getTime();

  return {
    canMarkArrived: nowMs >= startMs - ARRIVAL_OPENS_BEFORE_MS && nowMs < endOfDayMs,
    canMarkNoShow: nowMs >= startMs,
  };
}
