import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { applyOfferSchedule } from "./applyOfferSchedule.js";

// Far-future dates in UTC, so neither real data nor the live API's hourly
// generator (which works from today) interferes.
const NOW = new Date("2033-03-07T00:00:00Z");
const DAY1 = "2033-03-07";
const DAY2 = "2033-03-08";

describe("applyOfferSchedule", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantId: string;
  let offerId: string;

  // Only this test's dates: the live API may add today's slots to any active offer.
  const slotsByKey = async () => {
    const slots = await prisma.slot.findMany({ where: { offerId, date: { gte: new Date(`${DAY1}T00:00:00Z`) } } });
    return Object.fromEntries(
      slots.map((s) => [`${s.date.toISOString().slice(0, 10)} ${s.startTime}`, { seats: s.seatsTotal, discount: s.discountPercent }]),
    );
  };

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({ data: { name: `Schedule Test ${suffix}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Обед",
        discountPercent: 20,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "12:00",
        endTime: "15:00",
        seatsPerSlot: 4,
      },
    });
    offerId = offer.id;

    const initial = await applyOfferSchedule({ offerId, previousSeatsPerSlot: 4, now: NOW, timeZone: "UTC", horizonDays: 2 });
    expect(initial.created).toBe(6);

    // A guest booked day 1 at 12:00; staff closed day 1 at 14:00 for a banquet.
    const booked = await prisma.slot.findFirstOrThrow({ where: { offerId, date: new Date(`${DAY1}T00:00:00Z`), startTime: "12:00" } });
    await prisma.slot.update({ where: { id: booked.id }, data: { seatsBooked: 1 } });
    await prisma.booking.create({ data: { slotId: booked.id, guestTelegramId: 1n, code: `SC${suffix}` } });
    await prisma.slot.updateMany({ where: { offerId, date: new Date(`${DAY1}T00:00:00Z`), startTime: "14:00" }, data: { seatsTotal: 0 } });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slot: { offerId } } });
    await prisma.slot.deleteMany({ where: { offerId } });
    await prisma.offer.deleteMany({ where: { id: offerId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("moves empty slots to the new schedule while honouring bookings and manual capacity", async () => {
    await prisma.offer.update({ where: { id: offerId }, data: { startTime: "13:00", endTime: "17:00", discountPercent: 30, seatsPerSlot: 6 } });

    const summary = await applyOfferSchedule({ offerId, previousSeatsPerSlot: 4, now: NOW, timeZone: "UTC", horizonDays: 2 });

    expect(summary).toEqual({ created: 4, updated: 4, removed: 1, keptBooked: 1 });
    expect(await slotsByKey()).toEqual({
      // Booked under the old terms: kept as the guest agreed (old discount).
      [`${DAY1} 12:00`]: { seats: 4, discount: 20 },
      [`${DAY1} 13:00`]: { seats: 6, discount: 30 },
      // Closed by hand for a banquet: stays closed, takes the new discount.
      [`${DAY1} 14:00`]: { seats: 0, discount: 30 },
      [`${DAY1} 15:00`]: { seats: 6, discount: 30 },
      [`${DAY1} 16:00`]: { seats: 6, discount: 30 },
      [`${DAY2} 13:00`]: { seats: 6, discount: 30 },
      [`${DAY2} 14:00`]: { seats: 6, discount: 30 },
      [`${DAY2} 15:00`]: { seats: 6, discount: 30 },
      [`${DAY2} 16:00`]: { seats: 6, discount: 30 },
    });
  });

  it("is a no-op when nothing changed", async () => {
    const summary = await applyOfferSchedule({ offerId, previousSeatsPerSlot: 6, now: NOW, timeZone: "UTC", horizonDays: 2 });
    expect(summary).toEqual({ created: 0, updated: 0, removed: 0, keptBooked: 1 });
  });
});
