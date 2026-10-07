import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { runStaffNotificationTick, type StaffDelivery } from "./notifyStaffJob.js";

// Far-future clock: the live bot (real "now") never sees these bookings in its 24h window.
const NOW = new Date("2031-03-03T10:00:00Z");
const STAFF_A1 = 8801n;
const STAFF_A2 = 8802n;
const STAFF_B = 8803n;

describe("runStaffNotificationTick", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantAId = "";
  let restaurantBId = "";
  let slotAId = "";
  let counter = 0;

  async function cleanup() {
    const ids = [restaurantAId, restaurantBId].filter(Boolean);
    if (ids.length === 0) return;
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId: { in: ids } } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId: { in: ids } } } });
    await prisma.offer.deleteMany({ where: { restaurantId: { in: ids } } });
    await prisma.restaurantStaff.deleteMany({ where: { restaurantId: { in: ids } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: ids } } });
  }

  async function makeBooking(opts: { status?: "confirmed" | "cancelled"; createdAt?: Date } = {}) {
    counter += 1;
    return prisma.booking.create({
      data: {
        slotId: slotAId,
        guestTelegramId: 1n,
        partySize: 3,
        code: `N${suffix}${counter}`,
        status: opts.status ?? "confirmed",
        createdAt: opts.createdAt ?? new Date("2031-03-03T09:58:00Z"),
      },
    });
  }

  beforeEach(async () => {
    await cleanup();
    const a = await prisma.restaurant.create({ data: { name: `Notify A ${suffix}` } });
    const b = await prisma.restaurant.create({ data: { name: `Notify B ${suffix}` } });
    restaurantAId = a.id;
    restaurantBId = b.id;
    await prisma.restaurantStaff.createMany({
      data: [
        { restaurantId: a.id, telegramUserId: STAFF_A1, role: "owner" },
        { restaurantId: a.id, telegramUserId: STAFF_A2, role: "staff" },
        { restaurantId: b.id, telegramUserId: STAFF_B, role: "owner" },
      ],
    });
    const offer = await prisma.offer.create({
      data: { restaurantId: a.id, title: "Тихий обед", discountPercent: 20, daysOfWeek: [1], startTime: "12:00", endTime: "18:00", seatsPerSlot: 8 },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2031-03-03T00:00:00Z"), startTime: "15:00", endTime: "16:00", seatsTotal: 8, discountPercent: 20 },
    });
    slotAId = slot.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  function recorder(fail: (d: StaffDelivery) => void = () => {}) {
    const deliveries: StaffDelivery[] = [];
    return {
      deliveries,
      // Only our synthetic staff; other suites' rows may sit in the same table.
      ours: () => deliveries.filter((d) => [STAFF_A1, STAFF_A2, STAFF_B].includes(d.chatId)),
      send: async (d: StaffDelivery) => {
        fail(d);
        deliveries.push(d);
      },
    };
  }

  const tick = (send: (d: StaffDelivery) => Promise<void>, isPermanentFailure?: (err: unknown) => boolean) =>
    runStaffNotificationTick({ now: NOW, timeZone: "UTC", send, isPermanentFailure });

  it("tells every staff member of that restaurant exactly once", async () => {
    const booking = await makeBooking();
    const r = recorder();

    await tick(r.send);
    await tick(r.send);

    expect(r.ours().map((d) => d.chatId).sort()).toEqual([STAFF_A1, STAFF_A2]);
    expect(r.ours()[0].text).toBe(["Новая бронь · сегодня, 15:00", "Тихий обед, скидка 20%", `Гостей: 3 · код ${booking.code}`].join("\n"));
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.staffNotifiedAt).not.toBeNull();
  });

  it("skips bookings cancelled before staff were told, and stale ones", async () => {
    const cancelled = await makeBooking({ status: "cancelled" });
    const stale = await makeBooking({ createdAt: new Date("2031-03-01T09:00:00Z") });
    const r = recorder();

    await tick(r.send);

    expect(r.ours()).toHaveLength(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: cancelled.id } })).staffNotifiedAt).not.toBeNull();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: stale.id } })).staffNotifiedAt).toBeNull();
  });

  it("retries on the next tick when nobody could be reached", async () => {
    const booking = await makeBooking();
    const down = recorder(() => {
      throw new Error("network down");
    });

    await tick(down.send);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).staffNotifiedAt).toBeNull();

    const up = recorder();
    await tick(up.send);
    expect(up.ours()).toHaveLength(2);
  });

  it("does not retry when at least one staff member got it", async () => {
    const booking = await makeBooking();
    const partial = recorder((d) => {
      if (d.chatId === STAFF_A2) throw Object.assign(new Error("blocked"), { permanent: true });
    });

    await tick(partial.send, (err) => (err as { permanent?: boolean }).permanent === true);
    await tick(partial.send, (err) => (err as { permanent?: boolean }).permanent === true);

    expect(partial.ours().map((d) => d.chatId)).toEqual([STAFF_A1]);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).staffNotifiedAt).not.toBeNull();
  });

  it("never notifies twice when ticks overlap", async () => {
    await makeBooking();
    const r = recorder();

    await Promise.all([tick(r.send), tick(r.send)]);

    expect(r.ours()).toHaveLength(2);
  });
});
