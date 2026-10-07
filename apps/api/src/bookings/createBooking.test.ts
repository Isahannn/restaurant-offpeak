import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { createBooking } from "./createBooking.js";

describe("createBooking", () => {
  let restaurantId: string;
  let offerId: string;
  let slotId: string;

  beforeEach(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: `Booking Test Restaurant ${Date.now()}-${Math.random()}` },
    });
    restaurantId = restaurant.id;

    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Dinner offer",
        discountPercent: 15,
        exceptions: [],
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
        startTime: "19:00",
        endTime: "21:00",
        seatsPerSlot: 3,
        active: true,
      },
    });
    offerId = offer.id;

    const slot = await prisma.slot.create({
      data: {
        offerId,
        date: new Date("2036-12-01T00:00:00.000Z"),
        startTime: "19:00",
        endTime: "21:00",
        seatsTotal: 3,
        seatsBooked: 0,
      },
    });
    slotId = slot.id;
  });

  afterEach(async () => {
    await prisma.booking.deleteMany({ where: { slotId } });
    await prisma.slot.deleteMany({ where: { offerId } });
    await prisma.offer.deleteMany({ where: { id: offerId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a non-positive party size", async () => {
    const result = await createBooking({ slotId, guestTelegramId: 1n, partySize: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_party_size");
  });

  it("rejects booking a slot that does not exist", async () => {
    const result = await createBooking({
      slotId: "nonexistent-slot-id",
      guestTelegramId: 1n,
      partySize: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("slot_not_found");
  });

  it("rejects a slot that has already started in the restaurant's time zone", async () => {
    // Slot is 2036-12-01 19:00 Moscow time = 16:00 UTC.
    const result = await createBooking({
      slotId,
      guestTelegramId: 1n,
      partySize: 1,
      now: new Date("2036-12-01T16:00:00Z"),
      timeZone: "Europe/Moscow",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("slot_started");

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(0);
  });

  it("still accepts a slot a minute before it starts", async () => {
    const result = await createBooking({
      slotId,
      guestTelegramId: 1n,
      partySize: 1,
      now: new Date("2036-12-01T15:59:00Z"),
      timeZone: "Europe/Moscow",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects booking a slot of a deactivated offer without taking seats", async () => {
    await prisma.offer.update({ where: { id: offerId }, data: { active: false } });

    const result = await createBooking({ slotId, guestTelegramId: 1n, partySize: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("slot_not_found");

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(0);
  });

  it("creates a confirmed booking and increments seatsBooked", async () => {
    const result = await createBooking({ slotId, guestTelegramId: 42n, partySize: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booking.status).toBe("confirmed");
      expect(result.booking.partySize).toBe(2);
      expect(result.booking.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(result.booking.slot.offer.restaurant.name).toContain("Booking Test Restaurant");
    }

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(2);
  });

  it("rejects a party size larger than the remaining seats", async () => {
    const result = await createBooking({ slotId, guestTelegramId: 1n, partySize: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("sold_out");

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(0);
  });

  it("never overbooks a slot under concurrent requests", async () => {
    // seatsTotal is 3; fire 5 concurrent single-seat bookings.
    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createBooking({ slotId, guestTelegramId: BigInt(i + 1), partySize: 1 }),
      ),
    );

    const succeeded = attempts.filter((r) => r.ok);
    const soldOut = attempts.filter((r) => !r.ok && r.reason === "sold_out");

    expect(succeeded).toHaveLength(3);
    expect(soldOut).toHaveLength(2);

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(3);

    const bookings = await prisma.booking.findMany({ where: { slotId } });
    expect(bookings).toHaveLength(3);
    const codes = new Set(bookings.map((b) => b.code));
    expect(codes.size).toBe(3);
  });
});
