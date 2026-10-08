import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { disputeVisit } from "./disputeVisit.js";
import { runGuestVisitTick, type VisitDelivery } from "./notifyGuestVisitJob.js";

// Far-future clock: the live bot (real "now") never sees these rows in its 24h window.
const NOW = new Date("2031-06-02T20:00:00Z");
const GUEST = 9301n;
const OTHER_GUEST = 9302n;

describe("guest visit notifications and disputes", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantId = "";
  let slotId = "";
  let counter = 0;

  async function makeBooking(status: "arrived" | "no_show" | "confirmed", updatedAt = new Date("2031-06-02T19:30:00Z")) {
    counter += 1;
    return prisma.booking.create({
      data: { slotId, guestTelegramId: GUEST, code: `V${suffix}${counter}`, status, updatedAt },
    });
  }

  async function cleanup() {
    if (!restaurantId) return;
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId } } });
    await prisma.offer.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
  }

  beforeEach(async () => {
    await cleanup();
    const restaurant = await prisma.restaurant.create({ data: { name: `Visit Test ${suffix}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: { restaurantId, title: "Ужин", discountPercent: 20, daysOfWeek: [1], startTime: "18:00", endTime: "20:00", seatsPerSlot: 6 },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2031-06-02T00:00:00Z"), startTime: "18:00", endTime: "19:00", seatsTotal: 6, discountPercent: 20 },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  function recorder(fail?: () => void) {
    const deliveries: VisitDelivery[] = [];
    return {
      ours: () => deliveries.filter((d) => d.chatId === GUEST),
      send: async (d: VisitDelivery) => {
        fail?.();
        deliveries.push(d);
      },
    };
  }
  const tick = (send: (d: VisitDelivery) => Promise<void>) => runGuestVisitTick({ now: NOW, timeZone: "UTC", send });

  it("thanks the guest once per arrival, with a dispute button", async () => {
    const booking = await makeBooking("arrived");
    const r = recorder();

    await tick(r.send);
    await tick(r.send);

    expect(r.ours()).toHaveLength(1);
    expect(r.ours()[0]).toMatchObject({ bookingId: booking.id, disputeLabel: "Меня там не было" });
    expect(r.ours()[0].text).toContain(`Спасибо, что зашли в Visit Test ${suffix}!`);
    expect(r.ours()[0].text).toContain("сегодня, 18:00 · скидка 20%");
  });

  it("offers 'I was there' for a no-show and ignores unmarked or stale bookings", async () => {
    const noShow = await makeBooking("no_show");
    await makeBooking("confirmed");
    await makeBooking("arrived", new Date("2031-05-30T19:00:00Z")); // older than 24h
    const r = recorder();

    await tick(r.send);

    expect(r.ours().map((d) => [d.bookingId, d.disputeLabel])).toEqual([[noShow.id, "Я был в ресторане"]]);
  });

  it("retries after a transient failure", async () => {
    await makeBooking("arrived");
    await tick(
      recorder(() => {
        throw new Error("network down");
      }).send,
    );

    const r = recorder();
    await tick(r.send);
    expect(r.ours()).toHaveLength(1);
  });

  it("lets only the booking's own guest dispute, idempotently", async () => {
    const booking = await makeBooking("arrived");

    expect(await disputeVisit(booking.id, OTHER_GUEST, NOW)).toBe("not_found");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).disputedAt).toBeNull();

    expect(await disputeVisit(booking.id, GUEST, NOW)).toBe("disputed");
    expect(await disputeVisit(booking.id, GUEST, NOW)).toBe("already_disputed");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).disputedAt).toEqual(NOW);
  });

  it("refuses to dispute a booking that has no visit mark", async () => {
    const booking = await makeBooking("confirmed");
    expect(await disputeVisit(booking.id, GUEST, NOW)).toBe("not_found");
  });
});
