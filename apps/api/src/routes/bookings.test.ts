import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import bookingsRoutes from "./bookings.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

function buildInitData(telegramUserId: number): string {
  const fields = {
    user: JSON.stringify({ id: telegramUserId, username: "guest" }),
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

function buildApp() {
  const app = Fastify();
  app.register(authPlugin, { botToken: BOT_TOKEN });
  app.register(bookingsRoutes);
  return app;
}

describe("bookings routes", () => {
  let restaurantId: string;
  let offerId: string;
  let slotId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: `Bookings Route Test ${Date.now()}` },
    });
    restaurantId = restaurant.id;

    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Route test offer",
        discountPercent: 10,
        exceptions: [],
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
        startTime: "18:00",
        endTime: "20:00",
        seatsPerSlot: 2,
        active: true,
      },
    });
    offerId = offer.id;

    const slot = await prisma.slot.create({
      data: {
        offerId,
        date: new Date("2026-12-10T00:00:00.000Z"),
        startTime: "18:00",
        endTime: "20:00",
        seatsTotal: 2,
        seatsBooked: 0,
      },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slotId } });
    await prisma.slot.deleteMany({ where: { offerId } });
    await prisma.offer.deleteMany({ where: { id: offerId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("returns 401 without valid init data", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      payload: { slotId, partySize: 1 },
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a booking and returns the confirmation with code", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      headers: { "x-telegram-init-data": buildInitData(111) },
      payload: { slotId, partySize: 2 },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(body.status).toBe("confirmed");
    expect(body.restaurantName).toMatch(/^Bookings Route Test/);
    expect(body.guestTelegramId).toBe("111");
  });

  it("returns 409 when the slot is sold out", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      headers: { "x-telegram-init-data": buildInitData(222) },
      payload: { slotId, partySize: 1 },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns 400 for an invalid party size", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/bookings",
      headers: { "x-telegram-init-data": buildInitData(333) },
      payload: { slotId, partySize: 0 },
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists the guest's own bookings via GET /bookings/me", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/bookings/me",
      headers: { "x-telegram-init-data": buildInitData(111) },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { bookings: Array<{ guestTelegramId: string }> };
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0].guestTelegramId).toBe("111");
  });
});
