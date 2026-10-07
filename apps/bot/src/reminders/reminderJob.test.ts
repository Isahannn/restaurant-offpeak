import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { runReminderTick, type ReminderDelivery } from "./reminderJob.js";

// Far-future fixed clock so test slots never collide with seeded/real data.
const NOW = new Date("2031-02-03T10:00:00Z");
const LEAD_MINUTES = 120;
const DAY = "2031-02-03";

describe("runReminderTick", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantId: string;
  let offerId: string;
  let codeCounter = 0;

  async function makeBooking(opts: {
    startTime: string;
    status?: "pending" | "confirmed" | "cancelled" | "arrived";
    createdAt?: Date;
    guest?: bigint;
  }) {
    const slot = await prisma.slot.upsert({
      where: { offerId_date_startTime: { offerId, date: new Date(`${DAY}T00:00:00Z`), startTime: opts.startTime } },
      create: { offerId, date: new Date(`${DAY}T00:00:00Z`), startTime: opts.startTime, endTime: "23:00", seatsTotal: 20, discountPercent: 15 },
      update: {},
    });
    codeCounter += 1;
    return prisma.booking.create({
      data: {
        slotId: slot.id,
        guestTelegramId: opts.guest ?? 555n,
        partySize: 2,
        code: `R${suffix}${codeCounter}`,
        status: opts.status ?? "confirmed",
        createdAt: opts.createdAt ?? new Date("2031-02-01T12:00:00Z"),
      },
    });
  }

  beforeEach(async () => {
    if (offerId) {
      await prisma.booking.deleteMany({ where: { slot: { offerId } } });
      await prisma.slot.deleteMany({ where: { offerId } });
      await prisma.offer.deleteMany({ where: { id: offerId } });
      await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    }
    const restaurant = await prisma.restaurant.create({ data: { name: `Reminder Test ${suffix}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: { restaurantId, title: "Тихий обед", discountPercent: 15, daysOfWeek: [1], startTime: "08:00", endTime: "23:00", seatsPerSlot: 20 },
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

  function recordingSender(behaviour: (d: ReminderDelivery) => void = () => {}) {
    const deliveries: ReminderDelivery[] = [];
    return {
      deliveries,
      send: async (delivery: ReminderDelivery) => {
        behaviour(delivery);
        deliveries.push(delivery);
      },
    };
  }

  const tick = (send: (d: ReminderDelivery) => Promise<void>, isPermanentFailure?: (err: unknown) => boolean) =>
    runReminderTick({ now: NOW, leadMinutes: LEAD_MINUTES, timeZone: "UTC", send, isPermanentFailure });

  it("sends exactly one reminder for a booking inside the lead window", async () => {
    const booking = await makeBooking({ startTime: "11:00" });
    const sender = recordingSender();

    const first = await tick(sender.send);
    const second = await tick(sender.send);

    expect(first).toEqual({ sent: 1, failed: 0 });
    expect(second).toEqual({ sent: 0, failed: 0 });
    expect(sender.deliveries).toHaveLength(1);
    expect(sender.deliveries[0].chatId).toBe(555n);
    expect(sender.deliveries[0].text).toContain(booking.code);
    expect(sender.deliveries[0].text).toContain("11:00");

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.reminderSentAt).not.toBeNull();
  });

  it("skips bookings outside the window, already started, or not active", async () => {
    await makeBooking({ startTime: "15:00" }); // too far ahead
    await makeBooking({ startTime: "09:00" }); // already started
    await makeBooking({ startTime: "11:30", status: "cancelled" });
    await makeBooking({ startTime: "11:45", status: "arrived" });
    const sender = recordingSender();

    expect(await tick(sender.send)).toEqual({ sent: 0, failed: 0 });
    expect(sender.deliveries).toHaveLength(0);
  });

  it("does not remind about a booking made inside the reminder window", async () => {
    await makeBooking({ startTime: "11:00", createdAt: new Date("2031-02-03T09:30:00Z") });
    const sender = recordingSender();

    expect(await tick(sender.send)).toEqual({ sent: 0, failed: 0 });
  });

  it("releases the claim after a transient failure so the next tick retries", async () => {
    const booking = await makeBooking({ startTime: "11:00" });
    const failing = recordingSender(() => {
      throw new Error("network down");
    });

    expect(await tick(failing.send)).toEqual({ sent: 0, failed: 1 });
    const afterFailure = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(afterFailure.reminderSentAt).toBeNull();

    const working = recordingSender();
    expect(await tick(working.send)).toEqual({ sent: 1, failed: 0 });
  });

  it("keeps the claim after a permanent failure (e.g. the user blocked the bot)", async () => {
    const booking = await makeBooking({ startTime: "11:00" });
    const blocked = recordingSender(() => {
      throw Object.assign(new Error("Forbidden: bot was blocked by the user"), { permanent: true });
    });

    expect(await tick(blocked.send, (err) => (err as { permanent?: boolean }).permanent === true)).toEqual({
      sent: 0,
      failed: 1,
    });
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.reminderSentAt).not.toBeNull();
  });

  it("never sends twice when two ticks run concurrently", async () => {
    await makeBooking({ startTime: "11:00" });
    const sender = recordingSender();

    const results = await Promise.all([tick(sender.send), tick(sender.send)]);

    expect(results.reduce((sum, r) => sum + r.sent, 0)).toBe(1);
    expect(sender.deliveries).toHaveLength(1);
  });
});
