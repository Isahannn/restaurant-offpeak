import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@app/db";

const codes = vi.hoisted(() => ({ queue: [] as string[] }));

vi.mock("./generateBookingCode.js", () => ({
  generateBookingCode: () => codes.queue.shift() ?? "ZZZZZZ",
}));

const { createBooking } = await import("./createBooking.js");

describe("createBooking code collisions", () => {
  const suffix = `${Date.now()}`.slice(-4);
  const takenCode = `T${suffix}X`;
  const freshCode = `F${suffix}X`;
  let restaurantId: string;
  let slotId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({ data: { name: `Collision Test ${suffix}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Collision offer",
        discountPercent: 10,
        daysOfWeek: [1],
        startTime: "10:00",
        endTime: "11:00",
        seatsPerSlot: 5,
      },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2030-01-07T00:00:00Z"), startTime: "10:00", endTime: "11:00", seatsTotal: 5 },
    });
    slotId = slot.id;
    await prisma.booking.create({ data: { slotId, guestTelegramId: 1n, code: takenCode } });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slotId } });
    await prisma.slot.deleteMany({ where: { id: slotId } });
    await prisma.offer.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("retries with a new code when the generated one is already taken, counting seats once", async () => {
    codes.queue.push(takenCode, freshCode);

    const result = await createBooking({ slotId, guestTelegramId: 2n, partySize: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.booking.code).toBe(freshCode);

    const slot = await prisma.slot.findUniqueOrThrow({ where: { id: slotId } });
    expect(slot.seatsBooked).toBe(2);
  });
});
