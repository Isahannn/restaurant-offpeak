import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import staffPlugin from "../auth/staffPlugin.js";
import { createBooking } from "../bookings/createBooking.js";
import restaurantSlotsRoutes from "./restaurantSlots.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";
const STAFF_A = 7401;
const STAFF_B = 7402;
const DATE = "2032-01-12";
// Slots below are on DATE in UTC; "now" is the morning before them.
const NOW = new Date(`${DATE}T09:00:00Z`);

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
  app.register(restaurantSlotsRoutes, { now: () => now, timeZone: "UTC" });
  return app;
}

const asStaff = (id: number) => ({ "x-telegram-init-data": buildInitData(id) });

describe("restaurant slot capacity", () => {
  const suffix = `${Date.now()}`.slice(-5);
  let restaurantAId: string;
  let restaurantBId: string;
  const slotIds: Record<string, string> = {};

  beforeAll(async () => {
    const a = await prisma.restaurant.create({ data: { name: `Slots Test A ${suffix}` } });
    const b = await prisma.restaurant.create({ data: { name: `Slots Test B ${suffix}` } });
    restaurantAId = a.id;
    restaurantBId = b.id;
    await prisma.restaurantStaff.createMany({
      data: [
        { restaurantId: a.id, telegramUserId: BigInt(STAFF_A), role: "owner" },
        { restaurantId: b.id, telegramUserId: BigInt(STAFF_B), role: "owner" },
      ],
    });
    const offer = await prisma.offer.create({
      data: { restaurantId: a.id, title: "Ужин", discountPercent: 20, daysOfWeek: [1], startTime: "12:00", endTime: "22:00", seatsPerSlot: 8 },
    });
    for (const [time, booked] of [["12:00", 0], ["18:00", 3], ["19:00", 0], ["20:00", 2]] as const) {
      const slot = await prisma.slot.create({
        data: {
          offerId: offer.id,
          date: new Date(`${DATE}T00:00:00Z`),
          startTime: time,
          endTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00`,
          seatsTotal: 8,
          seatsBooked: booked,
        },
      });
      slotIds[time] = slot.id;
    }
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

  it("lists the day's slots for the caller's restaurant only", async () => {
    const own = await buildApp().inject({ method: "GET", url: `/restaurant/slots?date=${DATE}`, headers: asStaff(STAFF_A) });
    expect(own.statusCode).toBe(200);
    const slots = own.json().slots as Array<{ startTime: string; seatsBooked: number; defaultSeats: number; started: boolean }>;
    expect(slots.map((s) => s.startTime)).toEqual(["12:00", "18:00", "19:00", "20:00"]);
    expect(slots[1]).toMatchObject({ seatsBooked: 3, defaultSeats: 8, started: false });

    const foreign = await buildApp().inject({ method: "GET", url: `/restaurant/slots?date=${DATE}`, headers: asStaff(STAFF_B) });
    expect(foreign.json().slots).toEqual([]);
  });

  it("changes one slot's capacity but never below the seats already booked", async () => {
    const app = buildApp();
    const tooLow = await app.inject({ method: "PATCH", url: `/restaurant/slots/${slotIds["18:00"]}`, headers: asStaff(STAFF_A), payload: { seatsTotal: 2 } });
    expect(tooLow.statusCode).toBe(409);
    expect(tooLow.json()).toEqual({ error: "below_booked", seatsBooked: 3 });

    const ok = await app.inject({ method: "PATCH", url: `/restaurant/slots/${slotIds["18:00"]}`, headers: asStaff(STAFF_A), payload: { seatsTotal: 4 } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ seatsTotal: 4, seatsBooked: 3 });

    const foreign = await app.inject({ method: "PATCH", url: `/restaurant/slots/${slotIds["18:00"]}`, headers: asStaff(STAFF_B), payload: { seatsTotal: 20 } });
    expect(foreign.statusCode).toBe(404);

    const invalid = await app.inject({ method: "PATCH", url: `/restaurant/slots/${slotIds["18:00"]}`, headers: asStaff(STAFF_A), payload: { seatsTotal: -1 } });
    expect(invalid.statusCode).toBe(400);
  });

  it("refuses to edit a slot that already started", async () => {
    const response = await buildApp(new Date(`${DATE}T12:30:00Z`)).inject({
      method: "PATCH",
      url: `/restaurant/slots/${slotIds["12:00"]}`,
      headers: asStaff(STAFF_A),
      payload: { seatsTotal: 1 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("slot_started");
  });

  it("closes a banquet's hours: booked guests stay, new guests can't book", async () => {
    const closed = await buildApp().inject({
      method: "PATCH",
      url: "/restaurant/slots",
      headers: asStaff(STAFF_A),
      payload: { date: DATE, from: "18:00", to: "21:00", action: "close" },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().updated).toBe(3);
    const byTime = Object.fromEntries((closed.json().slots as Array<{ startTime: string; seatsTotal: number }>).map((s) => [s.startTime, s.seatsTotal]));
    expect(byTime).toEqual({ "12:00": 8, "18:00": 3, "19:00": 0, "20:00": 2 });

    const blocked = await createBooking({ slotId: slotIds["19:00"], guestTelegramId: 1n, partySize: 1, now: NOW, timeZone: "UTC" });
    expect(blocked).toEqual({ ok: false, reason: "sold_out" });
    const lunchStillOpen = await createBooking({ slotId: slotIds["12:00"], guestTelegramId: 1n, partySize: 1, now: NOW, timeZone: "UTC" });
    expect(lunchStillOpen.ok).toBe(true);

    const reopened = await buildApp().inject({
      method: "PATCH",
      url: "/restaurant/slots",
      headers: asStaff(STAFF_A),
      payload: { date: DATE, from: "18:00", to: "21:00", action: "open" },
    });
    const after = Object.fromEntries((reopened.json().slots as Array<{ startTime: string; seatsTotal: number }>).map((s) => [s.startTime, s.seatsTotal]));
    expect(after).toMatchObject({ "18:00": 8, "19:00": 8, "20:00": 8 });
  });

  it("validates the bulk request", async () => {
    const response = await buildApp().inject({
      method: "PATCH",
      url: "/restaurant/slots",
      headers: asStaff(STAFF_A),
      payload: { date: DATE, from: "21:00", to: "18:00", action: "close" },
    });
    expect(response.statusCode).toBe(400);
  });
});
