import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@app/db";
import authPlugin from "../auth/authPlugin.js";
import staffPlugin from "../auth/staffPlugin.js";
import { createBookingEventHub, type BookingEventHub } from "../realtime/bookingEventHub.js";
import restaurantEventsRoutes from "./restaurantEvents.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";
const STAFF = 7301;
const suffix = `${Date.now()}`.slice(-5);

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

describe("GET /restaurant/events", () => {
  let app: FastifyInstance;
  let hub: BookingEventHub;
  let baseUrl: string;
  let restaurantId: string;
  let slotId: string;

  beforeAll(async () => {
    hub = createBookingEventHub(process.env.DATABASE_URL!, { log: () => {} });
    await hub.ready;

    app = Fastify();
    await app.register(authPlugin, { botToken: BOT_TOKEN });
    await app.register(staffPlugin);
    await app.register(restaurantEventsRoutes, { hub, heartbeatMs: 50 });
    await app.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

    const restaurant = await prisma.restaurant.create({ data: { name: `Stream Test ${suffix}` } });
    restaurantId = restaurant.id;
    await prisma.restaurantStaff.create({ data: { restaurantId, telegramUserId: BigInt(STAFF), role: "owner" } });
    const offer = await prisma.offer.create({
      data: { restaurantId, title: "Stream", discountPercent: 10, daysOfWeek: [1], startTime: "12:00", endTime: "13:00", seatsPerSlot: 4 },
    });
    const slot = await prisma.slot.create({
      data: { offerId: offer.id, date: new Date("2031-05-12T00:00:00Z"), startTime: "12:00", endTime: "13:00", seatsTotal: 4 },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { slot: { offer: { restaurantId } } } });
    await prisma.slot.deleteMany({ where: { offer: { restaurantId } } });
    await prisma.offer.deleteMany({ where: { restaurantId } });
    await prisma.restaurantStaff.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await app.close();
    await hub.close();
    await prisma.$disconnect();
  });

  it("rejects non-staff", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/restaurant/events",
      headers: { "x-telegram-init-data": buildInitData(7399) },
    });
    expect(response.statusCode).toBe(403);
  });

  it("streams the restaurant's booking events with heartbeats", async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/restaurant/events`, {
      headers: { "x-telegram-init-data": buildInitData(STAFF) },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    const readUntil = async (needle: string) => {
      const deadline = Date.now() + 3000;
      while (!received.includes(needle)) {
        if (Date.now() > deadline) throw new Error(`no "${needle}" in stream: ${received}`);
        const { value, done } = await reader.read();
        if (done) throw new Error("stream closed");
        received += decoder.decode(value, { stream: true });
      }
    };

    await readUntil(": connected");
    const booking = await prisma.booking.create({ data: { slotId, guestTelegramId: 1n, code: `ST${suffix}` } });
    await readUntil(booking.id);
    await readUntil(": ping");

    expect(received).toContain("event: booking\n");
    const dataLine = received.split("\n").find((line) => line.startsWith("data:") && line.includes(booking.id))!;
    expect(JSON.parse(dataLine.slice("data:".length))).toMatchObject({ bookingId: booking.id, type: "created" });

    controller.abort();
  });
});
