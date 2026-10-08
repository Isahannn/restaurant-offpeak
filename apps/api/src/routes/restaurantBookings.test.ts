import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import staffPlugin from "../auth/staffPlugin.js";
import restaurantBookingsRoutes from "./restaurantBookings.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";
const STAFF_A = 7001;
const STAFF_B = 7002;
const DATE = "2030-03-04";
// Slots below run 12:00–13:00 UTC on DATE; "now" is ten minutes in.
const NOW = new Date("2030-03-04T12:10:00Z");

function buildInitData(telegramUserId: number): string {
  const fields = {
    user: JSON.stringify({ id: telegramUserId, username: "staffer" }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key as keyof typeof fields]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function buildApp(now: Date = NOW) {
  const app = Fastify();
  app.register(authPlugin, { botToken: BOT_TOKEN });
  app.register(staffPlugin);
  app.register(restaurantBookingsRoutes, { now: () => now, timeZone: "UTC" });
  return app;
}

describe("restaurant bookings routes", () => {
  const suffix = Date.now();
  let restaurantAId: string;
  let restaurantBId: string;
  let bookingAId: string;
  let bookingBCode: string;
  let bookingACode: string;

  beforeAll(async () => {
    const a = await prisma.restaurant.create({ data: { name: `Bookings Test A ${suffix}` } });
    const b = await prisma.restaurant.create({ data: { name: `Bookings Test B ${suffix}` } });
    restaurantAId = a.id;
    restaurantBId = b.id;

    await prisma.restaurantStaff.create({
      data: { restaurantId: restaurantAId, telegramUserId: BigInt(STAFF_A), role: "owner" },
    });
    await prisma.restaurantStaff.create({
      data: { restaurantId: restaurantBId, telegramUserId: BigInt(STAFF_B), role: "owner" },
    });

    const makeSlot = async (restaurantId: string) => {
      const offer = await prisma.offer.create({
        data: {
          restaurantId,
          title: "Lunch",
          discountPercent: 20,
          exceptions: [],
          daysOfWeek: [1],
          startTime: "12:00",
          endTime: "13:00",
          seatsPerSlot: 10,
        },
      });
      return prisma.slot.create({
        data: {
          offerId: offer.id,
          date: new Date(`${DATE}T00:00:00Z`),
          startTime: "12:00",
          endTime: "13:00",
          seatsTotal: 10,
          seatsBooked: 3,
          discountPercent: 20,
        },
      });
    };

    const slotA = await makeSlot(restaurantAId);
    const slotB = await makeSlot(restaurantBId);

    const bookingA = await prisma.booking.create({
      data: { slotId: slotA.id, guestTelegramId: 1n, partySize: 3, code: `RA${suffix}` },
    });
    const bookingB = await prisma.booking.create({
      data: { slotId: slotB.id, guestTelegramId: 2n, partySize: 3, code: `RB${suffix}` },
    });
    bookingAId = bookingA.id;
    bookingACode = bookingA.code;
    bookingBCode = bookingB.code;
  });

  afterAll(async () => {
    const ids = [restaurantAId, restaurantBId];
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId: { in: ids } } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId: { in: ids } } } });
    await prisma.offer.deleteMany({ where: { restaurantId: { in: ids } } });
    await prisma.restaurantStaff.deleteMany({ where: { restaurantId: { in: ids } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("rejects non-staff users", async () => {
    const response = await buildApp().inject({
      method: "GET",
      url: `/restaurant/bookings?date=${DATE}`,
      headers: { "x-telegram-init-data": buildInitData(7999) },
    });

    expect(response.statusCode).toBe(403);
  });

  it("lists only the caller's restaurant bookings for the given date", async () => {
    const response = await buildApp().inject({
      method: "GET",
      url: `/restaurant/bookings?date=${DATE}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      bookings: Array<Record<string, unknown> & { codeHint: string; slotStartTime: string }>;
    };
    expect(body.bookings.map((b) => b.codeHint)).toEqual([`••••${bookingACode.slice(-2)}`]);
    expect(body.bookings[0].slotStartTime).toBe("12:00");
    // The full code must never reach the staff list.
    expect(JSON.stringify(body)).not.toContain(bookingACode);
    expect(body.bookings[0]).toMatchObject({ canMarkArrived: true, canMarkNoShow: true, disputed: false });
  });

  it("rejects an invalid date", async () => {
    const response = await buildApp().inject({
      method: "GET",
      url: "/restaurant/bookings?date=yesterday",
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
    });

    expect(response.statusCode).toBe(400);
  });

  it("does not check in another restaurant's booking code", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/restaurant/bookings/check-in",
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { code: bookingBCode },
    });

    expect(response.statusCode).toBe(404);
    const untouched = await prisma.booking.findUnique({ where: { code: bookingBCode } });
    expect(untouched?.status).toBe("pending");
  });

  it("refuses visit marks outside the visit window, e.g. two days early", async () => {
    const twoDaysEarly = buildApp(new Date("2030-03-02T12:10:00Z"));

    const manual = await twoDaysEarly.inject({
      method: "PATCH",
      url: `/restaurant/bookings/${bookingAId}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { status: "arrived" },
    });
    expect(manual.statusCode).toBe(409);
    expect(manual.json().error).toBe("outside_visit_window");

    const byCode = await twoDaysEarly.inject({
      method: "POST",
      url: "/restaurant/bookings/check-in",
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { code: bookingACode },
    });
    expect(byCode.statusCode).toBe(409);

    // No-show only after the slot started: 11:59 is too early.
    const noShowEarly = await buildApp(new Date("2030-03-04T11:59:00Z")).inject({
      method: "PATCH",
      url: `/restaurant/bookings/${bookingAId}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { status: "no_show" },
    });
    expect(noShowEarly.statusCode).toBe(409);

    const untouched = await prisma.booking.findUniqueOrThrow({ where: { id: bookingAId } });
    expect(untouched.status).toBe("pending");
  });

  it("checks in a booking by code, case-insensitively", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/restaurant/bookings/check-in",
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { code: ` ${bookingACode.toLowerCase()} ` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "arrived", checkInMethod: "code" });
  });

  it("refuses to check in the same booking twice", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/restaurant/bookings/check-in",
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { code: bookingACode },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("already_arrived");
  });

  it("marks a booking as no-show and refuses foreign bookings", async () => {
    const foreign = await buildApp().inject({
      method: "PATCH",
      url: `/restaurant/bookings/${bookingAId}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_B) },
      payload: { status: "no_show" },
    });
    expect(foreign.statusCode).toBe(404);

    const invalid = await buildApp().inject({
      method: "PATCH",
      url: `/restaurant/bookings/${bookingAId}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { status: "cancelled" },
    });
    expect(invalid.statusCode).toBe(400);

    const own = await buildApp().inject({
      method: "PATCH",
      url: `/restaurant/bookings/${bookingAId}`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
      payload: { status: "no_show" },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ status: "no_show", checkInMethod: null });

    // Every new mark is queued for the guest notification again.
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: bookingAId } });
    expect(stored.guestNotifiedStatusAt).toBeNull();
  });

  it("returns per-day fill stats reflecting visit marks", async () => {
    const response = await buildApp().inject({
      method: "GET",
      url: `/restaurant/stats?from=${DATE}&days=2`,
      headers: { "x-telegram-init-data": buildInitData(STAFF_A) },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { days: Array<Record<string, unknown>> };
    expect(body.days).toEqual([
      { date: DATE, seatsTotal: 10, seatsBooked: 3, arrived: 0, noShow: 1, disputed: 0 },
      { date: "2030-03-05", seatsTotal: 0, seatsBooked: 0, arrived: 0, noShow: 0, disputed: 0 },
    ]);
  });
});
