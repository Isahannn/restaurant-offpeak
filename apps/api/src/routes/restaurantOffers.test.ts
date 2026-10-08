import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import staffPlugin from "../auth/staffPlugin.js";
import restaurantOffersRoutes from "./restaurantOffers.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

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

function buildApp() {
  const app = Fastify();
  app.register(authPlugin, { botToken: BOT_TOKEN });
  app.register(staffPlugin);
  app.register(restaurantOffersRoutes);
  return app;
}

describe("restaurant offers admin routes", () => {
  let restaurantAId: string;
  let restaurantBId: string;
  let offerBId: string;

  beforeAll(async () => {
    const a = await prisma.restaurant.create({ data: { name: `Admin Test A ${Date.now()}` } });
    restaurantAId = a.id;
    const b = await prisma.restaurant.create({ data: { name: `Admin Test B ${Date.now()}` } });
    restaurantBId = b.id;

    await prisma.restaurantStaff.create({
      data: { restaurantId: restaurantAId, telegramUserId: 6001n, role: "owner" },
    });
    await prisma.restaurantStaff.create({
      data: { restaurantId: restaurantBId, telegramUserId: 6002n, role: "owner" },
    });

    const offerB = await prisma.offer.create({
      data: {
        restaurantId: restaurantBId,
        title: "B's offer",
        discountPercent: 10,
        exceptions: [],
        daysOfWeek: [1],
        startTime: "10:00",
        endTime: "12:00",
        seatsPerSlot: 2,
        active: true,
      },
    });
    offerBId = offerB.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId: { in: [restaurantAId, restaurantBId] } } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId: { in: [restaurantAId, restaurantBId] } } } });
    await prisma.discountWindow.deleteMany({ where: { offer: { restaurantId: { in: [restaurantAId, restaurantBId] } } } });
    await prisma.offer.deleteMany({ where: { restaurantId: { in: [restaurantAId, restaurantBId] } } });
    await prisma.restaurantStaff.deleteMany({ where: { restaurantId: { in: [restaurantAId, restaurantBId] } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: [restaurantAId, restaurantBId] } } });
    await prisma.$disconnect();
  });

  it("creates an offer scoped to the staff member's own restaurant, ignoring any restaurantId in the body", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/restaurant/offers",
      headers: { "x-telegram-init-data": buildInitData(6001) },
      payload: {
        restaurantId: restaurantBId, // attacker-supplied, must be ignored
        title: "A's new offer",
        discountPercent: 20,
        exceptions: [],
        daysOfWeek: [1, 2],
        startTime: "11:00",
        endTime: "14:00",
        seatsPerSlot: 4,
        discountWindows: [{ startTime: "11:00", endTime: "12:00" }],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.restaurantId).toBe(restaurantAId);
    expect(body.discountWindows).toEqual([{ startTime: "11:00", endTime: "12:00" }]);
  });

  it("rejects an offer with out-of-range values", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/restaurant/offers",
      headers: { "x-telegram-init-data": buildInitData(6001) },
      payload: {
        title: "Broken",
        discountPercent: 150,
        exceptions: [],
        daysOfWeek: [9],
        startTime: "14:00",
        endTime: "11:00",
        seatsPerSlot: 0,
        discountWindows: [],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists only the caller's own restaurant offers", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/restaurant/offers",
      headers: { "x-telegram-init-data": buildInitData(6001) },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { offers: Array<{ id: string; restaurantId: string }> };
    expect(body.offers.every((o) => o.restaurantId === restaurantAId)).toBe(true);
    expect(body.offers.some((o) => o.id === offerBId)).toBe(false);
  });

  it("refuses to toggle another restaurant's offer", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "PATCH",
      url: `/restaurant/offers/${offerBId}`,
      headers: { "x-telegram-init-data": buildInitData(6001) },
      payload: { active: false },
    });

    expect(response.statusCode).toBe(404);

    const stillActive = await prisma.offer.findUnique({ where: { id: offerBId } });
    expect(stillActive?.active).toBe(true);
  });

  it("toggles the caller's own offer", async () => {
    const app = buildApp();

    const toggleResponse = await app.inject({
      method: "PATCH",
      url: `/restaurant/offers/${offerBId}`,
      headers: { "x-telegram-init-data": buildInitData(6002) },
      payload: { active: false },
    });

    expect(toggleResponse.statusCode).toBe(200);
    const updated = await prisma.offer.findUnique({ where: { id: offerBId } });
    expect(updated?.active).toBe(false);
  });

  it("edits an offer and reports how its slots changed", async () => {
    const app = buildApp();
    const payload = {
      title: "B's offer, edited",
      discountPercent: 25,
      exceptions: ["вино"],
      daysOfWeek: [1, 3],
      startTime: "10:00",
      endTime: "13:00",
      seatsPerSlot: 5,
      discountWindows: [{ startTime: "10:00", endTime: "11:00" }],
    };

    const foreign = await app.inject({
      method: "PATCH",
      url: `/restaurant/offers/${offerBId}`,
      headers: { "x-telegram-init-data": buildInitData(6001) },
      payload,
    });
    expect(foreign.statusCode).toBe(404);

    const invalid = await app.inject({
      method: "PATCH",
      url: `/restaurant/offers/${offerBId}`,
      headers: { "x-telegram-init-data": buildInitData(6002) },
      payload: { ...payload, endTime: "09:00" },
    });
    expect(invalid.statusCode).toBe(400);

    const ok = await app.inject({
      method: "PATCH",
      url: `/restaurant/offers/${offerBId}`,
      headers: { "x-telegram-init-data": buildInitData(6002) },
      payload,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      title: "B's offer, edited",
      discountPercent: 25,
      exceptions: ["вино"],
      daysOfWeek: [1, 3],
      seatsPerSlot: 5,
      discountWindows: [{ startTime: "10:00", endTime: "11:00" }],
      schedule: expect.objectContaining({ removed: expect.any(Number), created: expect.any(Number) }),
    });

    const windows = await prisma.discountWindow.findMany({ where: { offerId: offerBId } });
    expect(windows).toHaveLength(1);
  });
});
