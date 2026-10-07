import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import restaurantsRoutes from "./restaurants.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

function buildInitData(): string {
  const fields = {
    user: JSON.stringify({ id: 321, username: "guest" }),
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
  app.register(restaurantsRoutes);
  return app;
}

describe("GET /restaurants/:id", () => {
  let restaurantId: string;
  let otherRestaurantId: string;
  let activeOfferId: string;
  let inactiveOfferId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: `Restaurant Detail Test ${Date.now()}`,
        imageUrl: "https://example.com/photo.jpg",
        description: "Уютное место с домашней кухней.",
      },
    });
    restaurantId = restaurant.id;

    const otherRestaurant = await prisma.restaurant.create({
      data: { name: `Other Restaurant ${Date.now()}` },
    });
    otherRestaurantId = otherRestaurant.id;

    const activeOffer = await prisma.offer.create({
      data: {
        restaurantId,
        title: "Active offer",
        discountPercent: 10,
        exceptions: [],
        daysOfWeek: [1],
        startTime: "12:00",
        endTime: "13:00",
        seatsPerSlot: 2,
        active: true,
      },
    });
    activeOfferId = activeOffer.id;

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

    await prisma.offer.create({
      data: {
        restaurantId: otherRestaurantId,
        title: "Other restaurant offer",
        discountPercent: 99,
        exceptions: [],
        daysOfWeek: [1],
        startTime: "10:00",
        endTime: "11:00",
        seatsPerSlot: 2,
        active: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.offer.deleteMany({
      where: { restaurantId: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.restaurant.deleteMany({ where: { id: { in: [restaurantId, otherRestaurantId] } } });
    await prisma.$disconnect();
  });

  it("returns 401 without valid init data", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: `/restaurants/${restaurantId}` });

    expect(response.statusCode).toBe(401);
  });

  it("returns 404 for a restaurant that does not exist", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/restaurants/nonexistent-id",
      headers: { "x-telegram-init-data": buildInitData() },
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns restaurant details with only its own active offers", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/restaurants/${restaurantId}`,
      headers: { "x-telegram-init-data": buildInitData() },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      restaurant: { id: string; name: string; description?: string; imageUrl?: string };
      offers: Array<{ id: string }>;
    };

    expect(body.restaurant.id).toBe(restaurantId);
    expect(body.restaurant.description).toBe("Уютное место с домашней кухней.");

    const offerIds = body.offers.map((o) => o.id);
    expect(offerIds).toContain(activeOfferId);
    expect(offerIds).not.toContain(inactiveOfferId);
    expect(body.offers).toHaveLength(1);
  });
});
