import { prisma } from "@app/db";
import { localDateString, slotStartInstant } from "@app/shared";
import { computeSlotsForOffer } from "./slotGeneration.js";

export interface ApplyOfferScheduleInput {
  offerId: string;
  /** Capacity before the edit: slots still at this value were never adjusted by hand. */
  previousSeatsPerSlot: number;
  now: Date;
  timeZone: string;
  horizonDays: number;
}

export interface ScheduleChangeSummary {
  created: number;
  updated: number;
  removed: number;
  /** Booked slots outside the new schedule, kept so guests' bookings stand. */
  keptBooked: number;
}

/**
 * Brings an offer's future slots in line with its (edited) schedule.
 *
 * - Slots guests already booked keep their time and discount — that's what the
 *   guest agreed to — even if the new schedule no longer has them.
 * - Empty slots outside the new schedule are removed; matching ones take the
 *   new discount and end time; missing ones are created.
 * - Capacity follows the new seats-per-slot only where staff never changed it
 *   by hand, so a banquet closed on the Seats tab stays closed.
 * - Started and past slots are never touched.
 */
export async function applyOfferSchedule(input: ApplyOfferScheduleInput): Promise<ScheduleChangeSummary> {
  const { offerId, previousSeatsPerSlot, now, timeZone, horizonDays } = input;
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, include: { discountWindows: true } });
  const fromDate = localDateString(now, timeZone);

  const candidates = computeSlotsForOffer(
    {
      daysOfWeek: offer.daysOfWeek,
      startTime: offer.startTime,
      endTime: offer.endTime,
      seatsPerSlot: offer.seatsPerSlot,
      discountPercent: offer.discountPercent,
      discountWindows: offer.discountWindows.map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
    },
    { fromDate, days: horizonDays },
  );
  const byKey = new Map(candidates.map((c) => [`${c.date} ${c.startTime}`, c]));

  const existing = await prisma.slot.findMany({
    where: { offerId, date: { gte: new Date(`${fromDate}T00:00:00.000Z`) } },
    include: { _count: { select: { bookings: true } } },
  });

  const summary: ScheduleChangeSummary = { created: 0, updated: 0, removed: 0, keptBooked: 0 };
  const existingKeys = new Set<string>();

  for (const slot of existing) {
    const date = slot.date.toISOString().slice(0, 10);
    const key = `${date} ${slot.startTime}`;
    existingKeys.add(key);
    if (slotStartInstant(slot.date, slot.startTime, timeZone) <= now) continue;

    const candidate = byKey.get(key);
    const hasBookings = slot._count.bookings > 0;

    if (!candidate) {
      if (hasBookings) {
        summary.keptBooked += 1;
        continue;
      }
      // Guarded delete: if a guest books it this very moment, the slot stays.
      const { count } = await prisma.slot.deleteMany({ where: { id: slot.id, bookings: { none: {} } } });
      summary.removed += count;
      if (count === 0) summary.keptBooked += 1;
      continue;
    }

    const data: { endTime?: string; discountPercent?: number; seatsTotal?: number } = {};
    if (slot.endTime !== candidate.endTime) data.endTime = candidate.endTime;
    if (!hasBookings && slot.discountPercent !== candidate.discountPercent) data.discountPercent = candidate.discountPercent;
    if (slot.seatsTotal === previousSeatsPerSlot && slot.seatsTotal !== offer.seatsPerSlot) {
      data.seatsTotal = Math.max(slot.seatsBooked, offer.seatsPerSlot);
    }
    if (Object.keys(data).length > 0) {
      await prisma.slot.update({ where: { id: slot.id }, data });
      summary.updated += 1;
    }
  }

  const missing = candidates.filter((c) => !existingKeys.has(`${c.date} ${c.startTime}`));
  const upcoming = missing.filter((c) => slotStartInstant(new Date(`${c.date}T00:00:00.000Z`), c.startTime, timeZone) > now);
  if (upcoming.length > 0) {
    const { count } = await prisma.slot.createMany({
      data: upcoming.map((c) => ({
        offerId,
        date: new Date(`${c.date}T00:00:00.000Z`),
        startTime: c.startTime,
        endTime: c.endTime,
        seatsTotal: c.seatsTotal,
        discountPercent: c.discountPercent,
      })),
      skipDuplicates: true,
    });
    summary.created = count;
  }

  return summary;
}
