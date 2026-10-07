import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "./authPlugin.js";
import staffPlugin from "./staffPlugin.js";

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
  app.get(
    "/staff-only",
    {
      preHandler: [
        (request, reply) => app.requireTelegramAuth(request, reply),
        (request, reply) => app.requireRestaurantStaff(request, reply),
      ],
    },
    async (request) => ({ restaurantId: request.restaurantStaff?.restaurantId }),
  );
  return app;
}

describe("staffPlugin", () => {
  let restaurantAId: string;
  let restaurantBId: string;

  beforeAll(async () => {
    const a = await prisma.restaurant.create({ data: { name: `Staff Test A ${Date.now()}` } });
    restaurantAId = a.id;
    const b = await prisma.restaurant.create({ data: { name: `Staff Test B ${Date.now()}` } });
    restaurantBId = b.id;

    await prisma.restaurantStaff.create({
      data: { restaurantId: restaurantAId, telegramUserId: 5001n, role: "owner" },
    });
  });

  afterAll(async () => {
    await prisma.restaurantStaff.deleteMany({
      where: { restaurantId: { in: [restaurantAId, restaurantBId] } },
    });
    await prisma.restaurant.deleteMany({ where: { id: { in: [restaurantAId, restaurantBId] } } });
    await prisma.$disconnect();
  });

  it("returns 403 when the telegram user is not registered as staff anywhere", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/staff-only",
      headers: { "x-telegram-init-data": buildInitData(999999) },
    });

    expect(response.statusCode).toBe(403);
  });

  it("attaches the staff member's own restaurantId, not an attacker-supplied one", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/staff-only",
      headers: { "x-telegram-init-data": buildInitData(5001) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().restaurantId).toBe(restaurantAId);
    expect(response.json().restaurantId).not.toBe(restaurantBId);
  });
});
