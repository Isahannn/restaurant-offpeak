import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { generateSlotsJob } from "./generateSlotsJob.js";

describe("generateSlotsJob", () => {
  let restaurantId: string;
  let offerId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: `Test Restaurant ${Date.now()}` },
    });
    restaurantId = restaurant.id;

    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Lunch happy hour",
        discountPercent: 30,
        exceptions: ["drinks"],
        daysOfWeek: [1, 3, 5],
        startTime: "12:00",
        endTime: "14:00",
        seatsPerSlot: 6,
        active: true,
      },
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

  it("creates slots for matching days within the horizon", async () => {
    // daysOfWeek [1,3,5] over 7 days = 3 matching days; 12:00-14:00 = 2 one-hour blocks each.
    const created = await generateSlotsJob({ horizonDays: 7, fromDate: "2026-10-05", offerId });

    expect(created).toBe(6);
    const slots = await prisma.slot.findMany({ where: { offerId } });
    expect(slots).toHaveLength(6);
  });

  it("is idempotent when run again for the same window", async () => {
    const created = await generateSlotsJob({ horizonDays: 7, fromDate: "2026-10-05", offerId });

    expect(created).toBe(0);
    const slots = await prisma.slot.findMany({ where: { offerId } });
    expect(slots).toHaveLength(6);
  });

  it("skips inactive offers", async () => {
    await prisma.offer.update({ where: { id: offerId }, data: { active: false } });

    const created = await generateSlotsJob({ horizonDays: 7, fromDate: "2026-11-02", offerId });

    expect(created).toBe(0);
  });
});
