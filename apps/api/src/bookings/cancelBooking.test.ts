import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { cancelBooking } from "./cancelBooking.js";

const GUEST = 4242n;
// Slot is 2036-12-10 19:00 Moscow time = 16:00 UTC.
const BEFORE_START = new Date("2036-12-10T15:00:00Z");
const AFTER_START = new Date("2036-12-10T16:00:00Z");
const TIME_ZONE = "Europe/Moscow";

describe("cancelBooking", () => {
  let restaurantId: string;
  let slotId: string;
  let codeCounter = 0;

  async function makeBooking(status: "confirmed" | "arrived" | "no_show" | "cancelled" = "confirmed", partySize = 2) {
    codeCounter += 1;
    await prisma.slot.update({ where: { id: slotId }, data: { seatsBooked: { increment: partySize } } });
    return prisma.booking.create({
      data: { slotId, guestTelegramId: GUEST, partySize, status, code: `C${Date.now() % 100000}${codeCounter}` },
    });
  }

  const seatsBooked = async () => (await prisma.slot.findUniqueOrThrow({ where: { id: slotId } })).seatsBooked;

  beforeEach(async () => {
    const restaurant = await prisma.restaurant.create({ data: { name: `Cancel Test ${Date.now()}` } });
    restaurantId = restaurant.id;
    const offer = await prisma.offer.create({
      data: { restaurantId, title: "Dinner", discountPercent: 15, daysOfWeek: [3], startTime: "19:00", endTime: "21:00", seatsPerSlot: 6 },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2036-12-10T00:00:00Z"), startTime: "19:00", endTime: "21:00", seatsTotal: 6 },
    });
    slotId = slot.id;
  });

  afterEach(async () => {
    await prisma.booking.deleteMany({ where: { slotId } });
    await prisma.slot.deleteMany({ where: { id: slotId } });
    await prisma.offer.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const cancel = (bookingId: string, opts: { guest?: bigint; now?: Date } = {}) =>
    cancelBooking({ bookingId, guestTelegramId: opts.guest ?? GUEST, now: opts.now ?? BEFORE_START, timeZone: TIME_ZONE });

  it("cancels the guest's booking and returns its seats to the slot", async () => {
    const booking = await makeBooking("confirmed", 2);
    expect(await seatsBooked()).toBe(2);

    const result = await cancel(booking.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.booking.status).toBe("cancelled");
    expect(await seatsBooked()).toBe(0);
  });

  it("treats someone else's booking as not found", async () => {
    const booking = await makeBooking();

    const result = await cancel(booking.id, { guest: 1n });

    expect(result).toEqual({ ok: false, reason: "booking_not_found" });
    expect(await seatsBooked()).toBe(2);
  });

  it("refuses a second cancellation without releasing seats twice", async () => {
    const other = await makeBooking("confirmed", 1);
    const booking = await makeBooking("confirmed", 2);

    await cancel(booking.id);
    const again = await cancel(booking.id);

    expect(again).toEqual({ ok: false, reason: "not_cancellable" });
    expect(await seatsBooked()).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("confirmed");
  });

  it("releases seats exactly once under concurrent cancellations", async () => {
    const booking = await makeBooking("confirmed", 2);

    const results = await Promise.all([cancel(booking.id), cancel(booking.id), cancel(booking.id)]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await seatsBooked()).toBe(0);
  });

  it("refuses bookings that were already marked as visited or missed", async () => {
    const arrived = await makeBooking("arrived");
    const noShow = await makeBooking("no_show");

    expect(await cancel(arrived.id)).toEqual({ ok: false, reason: "not_cancellable" });
    expect(await cancel(noShow.id)).toEqual({ ok: false, reason: "not_cancellable" });
  });

  it("refuses once the slot has started", async () => {
    const booking = await makeBooking();

    expect(await cancel(booking.id, { now: AFTER_START })).toEqual({ ok: false, reason: "slot_started" });
    expect(await seatsBooked()).toBe(2);
  });
});
