import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { markNoShows } from "./markNoShowsJob.js";

// Far-future clock so the live bot never touches these rows.
const NOW = new Date("2031-04-07T15:00:00Z");
const GRACE_MINUTES = 30;

describe("markNoShows", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantId: string;
  let offerId: string;
  let counter = 0;

  async function makeBooking(startTime: string, endTime: string, status: "confirmed" | "pending" | "arrived" | "cancelled" = "confirmed") {
    const date = new Date("2031-04-07T00:00:00Z");
    const slot = await prisma.slot.upsert({
      where: { offerId_date_startTime: { offerId, date, startTime } },
      create: { offerId, date, startTime, endTime, seatsTotal: 10 },
      update: {},
    });
    counter += 1;
    return prisma.booking.create({
      data: { slotId: slot.id, guestTelegramId: 1n, code: `S${suffix}${counter}`, status },
    });
  }

  const statusOf = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({ data: { name: `NoShow Test ${suffix}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: { restaurantId, title: "Lunch", discountPercent: 10, daysOfWeek: [1], startTime: "10:00", endTime: "18:00", seatsPerSlot: 10 },
    });
    offerId = offer.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slot: { offerId } } });
    await prisma.slot.deleteMany({ where: { offerId } });
    await prisma.offer.deleteMany({ where: { id: offerId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("marks unvisited bookings as no-show once the slot ended and the grace period passed", async () => {
    const ended = await makeBooking("13:00", "14:00"); // deadline 14:30 UTC < 15:00
    const pending = await makeBooking("13:15", "14:15", "pending");
    const inGrace = await makeBooking("14:00", "14:45"); // deadline 15:15 UTC > 15:00
    const arrived = await makeBooking("12:00", "13:00", "arrived");
    const cancelled = await makeBooking("11:00", "12:00", "cancelled");

    const marked = await markNoShows({ now: NOW, timeZone: "UTC", graceMinutes: GRACE_MINUTES });

    expect(marked).toBeGreaterThanOrEqual(2);
    expect(await statusOf(ended.id)).toBe("no_show");
    expect(await statusOf(pending.id)).toBe("no_show");
    expect(await statusOf(inGrace.id)).toBe("confirmed");
    expect(await statusOf(arrived.id)).toBe("arrived");
    expect(await statusOf(cancelled.id)).toBe("cancelled");
  });

  it("is idempotent", async () => {
    await markNoShows({ now: NOW, timeZone: "UTC", graceMinutes: GRACE_MINUTES });
    const before = await prisma.booking.count({ where: { slot: { offerId }, status: "no_show" } });

    await markNoShows({ now: NOW, timeZone: "UTC", graceMinutes: GRACE_MINUTES });

    expect(await prisma.booking.count({ where: { slot: { offerId }, status: "no_show" } })).toBe(before);
  });

  it("respects the restaurant's time zone", async () => {
    // 16:00–17:00 Moscow ends 14:00 UTC; deadline 14:30 UTC has passed.
    const moscow = await makeBooking("16:00", "17:00");
    // 17:30–18:00 Moscow ends 15:00 UTC; deadline 15:30 UTC is still ahead.
    const moscowLate = await makeBooking("17:30", "18:00");

    await markNoShows({ now: NOW, timeZone: "Europe/Moscow", graceMinutes: GRACE_MINUTES });

    expect(await statusOf(moscow.id)).toBe("no_show");
    expect(await statusOf(moscowLate.id)).toBe("confirmed");
  });
});
