import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { createBookingEventHub, type BookingEvent, type BookingEventHub } from "./bookingEventHub.js";

const suffix = `${Date.now()}`.slice(-5);

/** Collects events and lets a test wait until a matching one arrives. */
function collector() {
  const events: BookingEvent[] = [];
  const waiters: Array<{ match: (e: BookingEvent) => boolean; resolve: (e: BookingEvent) => void }> = [];
  return {
    events,
    push(event: BookingEvent) {
      events.push(event);
      for (const w of [...waiters]) {
        if (w.match(event)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(event);
        }
      }
    },
    waitFor(match: (e: BookingEvent) => boolean, timeoutMs = 3000): Promise<BookingEvent> {
      const existing = events.find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timed out waiting for booking event")), timeoutMs);
        waiters.push({ match, resolve: (e) => (clearTimeout(timer), resolve(e)) });
      });
    },
  };
}

describe("bookingEventHub", () => {
  let hub: BookingEventHub;
  let restaurantAId: string;
  let restaurantBId: string;
  let slotId: string;

  beforeAll(async () => {
    hub = createBookingEventHub(process.env.DATABASE_URL!, { log: () => {} });
    await hub.ready;

    const a = await prisma.restaurant.create({ data: { name: `Events Test A ${suffix}` } });
    const b = await prisma.restaurant.create({ data: { name: `Events Test B ${suffix}` } });
    restaurantAId = a.id;
    restaurantBId = b.id;
    const offer = await prisma.offer.create({
      data: { restaurantId: a.id, title: "Events", discountPercent: 10, daysOfWeek: [1], startTime: "12:00", endTime: "13:00", seatsPerSlot: 4 },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2031-05-05T00:00:00Z"), startTime: "12:00", endTime: "13:00", seatsTotal: 4 },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    const ids = [restaurantAId, restaurantBId];
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId: { in: ids } } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId: { in: ids } } } });
    await prisma.offer.deleteMany({ where: { restaurantId: { in: ids } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: ids } } });
    await hub.close();
    await prisma.$disconnect();
  });

  it("delivers new bookings and status changes to that restaurant only", async () => {
    const forA = collector();
    const forB = collector();
    const unsubscribeA = hub.subscribe(restaurantAId, forA.push);
    const unsubscribeB = hub.subscribe(restaurantBId, forB.push);

    const booking = await prisma.booking.create({
      data: { slotId, guestTelegramId: 1n, code: `EV${suffix}` },
    });
    const created = await forA.waitFor((e) => e.bookingId === booking.id && e.type === "created");
    expect(created).toEqual({ restaurantId: restaurantAId, bookingId: booking.id, type: "created", status: "pending" });

    // Bookkeeping columns must not wake the panel...
    await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
    // ...but a status change must.
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "arrived" } });
    await forA.waitFor((e) => e.bookingId === booking.id && e.status === "arrived");

    expect(forA.events.filter((e) => e.bookingId === booking.id).map((e) => e.type)).toEqual(["created", "status_changed"]);
    expect(forB.events).toHaveLength(0);

    unsubscribeA();
    unsubscribeB();
  });

  it("stops delivering after unsubscribe", async () => {
    const events = collector();
    const unsubscribe = hub.subscribe(restaurantAId, events.push);
    unsubscribe();

    await prisma.booking.create({ data: { slotId, guestTelegramId: 2n, code: `EU${suffix}` } });
    await new Promise((r) => setTimeout(r, 300));

    expect(events.events).toHaveLength(0);
  });
});
