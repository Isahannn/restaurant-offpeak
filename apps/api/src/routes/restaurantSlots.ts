import type { FastifyPluginAsync } from "fastify";
import type { RestaurantSlotDto } from "@app/shared";
import { prisma } from "@app/db";
import { slotStartInstant } from "@app/shared";
import { appTimeZone } from "../config.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SEATS = 200;

interface RestaurantSlotsOptions {
  /** Injectable clock and zone for tests; default to real time and APP_TIMEZONE. */
  now?: () => Date;
  timeZone?: string;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const slotInclude = { offer: { select: { title: true, seatsPerSlot: true } } } as const;

type SlotRow = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  seatsTotal: number;
  seatsBooked: number;
  discountPercent: number;
  offer: { title: string; seatsPerSlot: number };
};

/**
 * Per-slot capacity for the staff's own restaurant: shrink it for a banquet,
 * close hours entirely, or reopen them. Capacity can never drop below seats
 * already booked — the check lives in the UPDATE itself, so it stays correct
 * even when a guest books at the same moment.
 */
const restaurantSlotsRoutes: FastifyPluginAsync<RestaurantSlotsOptions> = async (fastify, options) => {
  const now = options.now ?? (() => new Date());
  const timeZone = options.timeZone ?? appTimeZone;

  const hasStarted = (slot: { date: Date; startTime: string }) =>
    slotStartInstant(slot.date, slot.startTime, timeZone).getTime() <= now().getTime();

  const toDto = (slot: SlotRow): RestaurantSlotDto => ({
    id: slot.id,
    offerTitle: slot.offer.title,
    date: slot.date.toISOString().slice(0, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
    seatsTotal: slot.seatsTotal,
    seatsBooked: slot.seatsBooked,
    defaultSeats: slot.offer.seatsPerSlot,
    discountPercent: slot.discountPercent,
    started: hasStarted(slot),
  });

  const listForDate = async (restaurantId: string, date: Date) => {
    const slots = await prisma.slot.findMany({
      where: { date, offer: { restaurantId } },
      include: slotInclude,
      orderBy: [{ startTime: "asc" }, { offer: { title: "asc" } }],
    });
    return slots.map(toDto);
  };

  const staffPreHandlers = [
    (request: Parameters<typeof fastify.requireTelegramAuth>[0], reply: Parameters<typeof fastify.requireTelegramAuth>[1]) =>
      fastify.requireTelegramAuth(request, reply),
    (request: Parameters<typeof fastify.requireRestaurantStaff>[0], reply: Parameters<typeof fastify.requireRestaurantStaff>[1]) =>
      fastify.requireRestaurantStaff(request, reply),
  ];

  fastify.get("/restaurant/slots", { preHandler: staffPreHandlers }, async (request, reply) => {
    const date = parseDate((request.query as { date?: unknown }).date);
    if (!date) return reply.code(400).send({ error: "invalid_date" });
    return { slots: await listForDate(request.restaurantStaff!.restaurantId, date) };
  });

  fastify.patch("/restaurant/slots/:id", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const { id } = request.params as { id: string };
    const seatsTotal = (request.body as { seatsTotal?: unknown } | undefined)?.seatsTotal;

    if (typeof seatsTotal !== "number" || !Number.isInteger(seatsTotal) || seatsTotal < 0 || seatsTotal > MAX_SEATS) {
      return reply.code(400).send({ error: "invalid_seats" });
    }

    const slot = await prisma.slot.findFirst({ where: { id, offer: { restaurantId } }, include: slotInclude });
    if (!slot) return reply.code(404).send({ error: "slot_not_found" });
    if (hasStarted(slot)) return reply.code(409).send({ error: "slot_started" });

    const updated = await prisma.slot.updateMany({
      where: { id, seatsBooked: { lte: seatsTotal } },
      data: { seatsTotal },
    });
    if (updated.count === 0) {
      const fresh = await prisma.slot.findUniqueOrThrow({ where: { id } });
      return reply.code(409).send({ error: "below_booked", seatsBooked: fresh.seatsBooked });
    }

    return toDto(await prisma.slot.findUniqueOrThrow({ where: { id }, include: slotInclude }));
  });

  fastify.patch("/restaurant/slots", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const body = (request.body ?? {}) as { date?: unknown; from?: unknown; to?: unknown; action?: unknown };
    const date = parseDate(body.date);
    const { from, to, action } = body;

    if (
      !date ||
      typeof from !== "string" ||
      typeof to !== "string" ||
      !TIME_PATTERN.test(from) ||
      !TIME_PATTERN.test(to) ||
      from >= to ||
      (action !== "close" && action !== "open")
    ) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const inRange = await prisma.slot.findMany({
      where: { date, startTime: { gte: from, lt: to }, offer: { restaurantId } },
      select: { id: true, date: true, startTime: true },
    });
    const ids = inRange.filter((slot) => !hasStarted(slot)).map((slot) => slot.id);

    if (ids.length > 0) {
      if (action === "close") {
        // Keep exactly the seats already taken: existing guests stay, nobody new gets in.
        await prisma.$executeRaw`
          UPDATE "Slot" SET "seatsTotal" = "seatsBooked" WHERE "id" = ANY(${ids})
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE "Slot" AS s SET "seatsTotal" = GREATEST(s."seatsBooked", o."seatsPerSlot")
          FROM "Offer" AS o
          WHERE o."id" = s."offerId" AND s."id" = ANY(${ids})
        `;
      }
    }

    return { updated: ids.length, slots: await listForDate(restaurantId, date) };
  });
};

export default restaurantSlotsRoutes;
