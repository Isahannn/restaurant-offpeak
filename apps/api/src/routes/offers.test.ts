import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import { localDateString } from "@app/shared";
import authPlugin from "../auth/authPlugin.js";
import offersRoutes from "./offers.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";
const TIME_ZONE = "Europe/Moscow";
const DAY_MS = 24 * 60 * 60 * 1000;
const today = localDateString(new Date(), TIME_ZONE);
const tomorrow = localDateString(new Date(Date.now() + DAY_MS), TIME_ZONE);

function buildInitData(fields: Record<string, string>): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function validInitData() {
  return buildInitData({
    user: JSON.stringify({ id: 555, username: "guest" }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
}

function buildApp() {
  const app = Fastify();
  app.register(authPlugin, { botToken: BOT_TOKEN });
  app.register(offersRoutes);
  return app;
}

describe("GET /offers", () => {
  let restaurantId: string;
  let activeOfferId: string;
  let inactiveOfferId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: `Offers Route Test ${Date.now()}` },
    });
    restaurantId = restaurant.id;

    const activeOffer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Active lunch offer",
        discountPercent: 20,
        exceptions: [],
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "12:00",
        endTime: "14:00",
        seatsPerSlot: 4,
        active: true,
      },
    });
    activeOfferId = activeOffer.id;

    await prisma.slot.create({
      data: {
        offerId: activeOfferId,
        date: new Date(`${tomorrow}T00:00:00.000Z`),
        startTime: "12:00",
        endTime: "14:00",
        seatsTotal: 4,
        seatsBooked: 1,
      },
    });

    // Started at midnight today: must never be offered for booking.
    await prisma.slot.create({
      data: {
        offerId: activeOfferId,
        date: new Date(`${today}T00:00:00.000Z`),
        startTime: "00:00",
        endTime: "01:00",
        seatsTotal: 4,
      },
    });

    const inactiveOffer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Inactive offer",
        discountPercent: 50,
        exceptions: [],
        daysOfWeek: [1],
        startTime: "10:00",
        endTime: "11:00",
        seatsPerSlot: 2,
        active: false,
      },
    });
    inactiveOfferId = inactiveOffer.id;
  });

  afterAll(async () => {
    await prisma.slot.deleteMany({ where: { offerId: activeOfferId } });
    await prisma.offer.deleteMany({ where: { id: { in: [activeOfferId, inactiveOfferId] } } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("returns 401 without a valid init data header", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/offers" });

    expect(response.statusCode).toBe(401);
  });

  it("returns only active offers with their restaurant name and upcoming slots", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/offers",
      headers: { "x-telegram-init-data": validInitData() },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { offers: Array<{ id: string; restaurantName: string; slots: unknown[] }> };

    const ids = body.offers.map((o) => o.id);
    expect(ids).toContain(activeOfferId);
    expect(ids).not.toContain(inactiveOfferId);

    const active = body.offers.find((o) => o.id === activeOfferId)!;
    expect(active.restaurantName).toMatch(/^Offers Route Test/);
    // Assert on what matters rather than an exact list: the live API's hourly
    // slot generator may add more slots to this active offer mid-test.
    const slots = active.slots as Array<{ date: string; startTime: string }>;
    expect(slots).toContainEqual(expect.objectContaining({ date: tomorrow, startTime: "12:00" }));
    expect(slots).not.toContainEqual(expect.objectContaining({ date: today, startTime: "00:00" }));
  });
});
