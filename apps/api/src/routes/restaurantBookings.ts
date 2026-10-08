import type { FastifyPluginAsync } from "fastify";
import type { RestaurantBookingDto, RestaurantDayStatsDto } from "@app/shared";
import { prisma } from "@app/db";
import { visitWindow } from "../bookings/visitWindow.js";
import { appTimeZone } from "../config.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STATS_DAYS = 31;
const MARKABLE_STATUSES = ["arrived", "no_show"] as const;
type MarkableStatus = (typeof MARKABLE_STATUSES)[number];

interface RestaurantBookingsOptions {
  /** Injectable clock and zone for tests; default to real time and APP_TIMEZONE. */
  now?: () => Date;
  timeZone?: string;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Staff see only the tail of a code, so "check-in by code" needs the guest present. */
export function maskCode(code: string): string {
  return `••••${code.slice(-2)}`;
}

const bookingInclude = { slot: { include: { offer: true } } } as const;

interface BookingRow {
  id: string;
  code: string;
  partySize: number;
  status: RestaurantBookingDto["status"];
  checkInMethod: RestaurantBookingDto["checkInMethod"];
  disputedAt: Date | null;
  slot: {
    date: Date;
    startTime: string;
    endTime: string;
    discountPercent: number;
    offer: { title: string };
  };
}

const restaurantBookingsRoutes: FastifyPluginAsync<RestaurantBookingsOptions> = async (fastify, options) => {
  const now = options.now ?? (() => new Date());
  const timeZone = options.timeZone ?? appTimeZone;

  const toDto = (booking: BookingRow): RestaurantBookingDto => {
    const open = booking.status !== "cancelled";
    const window = visitWindow(booking.slot, now(), timeZone);
    return {
      id: booking.id,
      codeHint: maskCode(booking.code),
      partySize: booking.partySize,
      status: booking.status,
      slotDate: toDateString(booking.slot.date),
      slotStartTime: booking.slot.startTime,
      slotEndTime: booking.slot.endTime,
      offerTitle: booking.slot.offer.title,
      discountPercent: booking.slot.discountPercent,
      checkInMethod: booking.checkInMethod,
      disputed: booking.disputedAt !== null,
      canMarkArrived: open && booking.status !== "arrived" && window.canMarkArrived,
      canMarkNoShow: open && booking.status !== "no_show" && window.canMarkNoShow,
    };
  };

  /** A fresh mark is announced to the guest again and supersedes an old dispute. */
  const markData = (status: MarkableStatus, method: "code" | "manual" | null) => ({
    status,
    checkInMethod: status === "arrived" ? method : null,
    guestNotifiedStatusAt: null,
    disputedAt: null,
  });

  const staffPreHandlers = [
    (request: Parameters<typeof fastify.requireTelegramAuth>[0], reply: Parameters<typeof fastify.requireTelegramAuth>[1]) =>
      fastify.requireTelegramAuth(request, reply),
    (request: Parameters<typeof fastify.requireRestaurantStaff>[0], reply: Parameters<typeof fastify.requireRestaurantStaff>[1]) =>
      fastify.requireRestaurantStaff(request, reply),
  ];

  fastify.get("/restaurant/bookings", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const date = parseDate((request.query as { date?: unknown }).date);

    if (!date) {
      return reply.code(400).send({ error: "invalid_date" });
    }

    const bookings = await prisma.booking.findMany({
      where: { slot: { date, offer: { restaurantId } } },
      include: bookingInclude,
      orderBy: [{ slot: { startTime: "asc" } }, { createdAt: "asc" }],
    });

    return { bookings: bookings.map(toDto) };
  });

  fastify.post("/restaurant/bookings/check-in", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const rawCode = (request.body as { code?: unknown } | undefined)?.code;

    if (typeof rawCode !== "string" || rawCode.trim() === "") {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const booking = await prisma.booking.findFirst({
      where: { code: rawCode.trim().toUpperCase(), slot: { offer: { restaurantId } } },
      include: { slot: true },
    });

    if (!booking) {
      return reply.code(404).send({ error: "booking_not_found" });
    }
    if (booking.status === "arrived") {
      return reply.code(409).send({ error: "already_arrived" });
    }
    if (booking.status === "cancelled") {
      return reply.code(409).send({ error: "booking_cancelled" });
    }
    if (!visitWindow(booking.slot, now(), timeZone).canMarkArrived) {
      return reply.code(409).send({ error: "outside_visit_window", slotDate: toDateString(booking.slot.date), slotStartTime: booking.slot.startTime });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: markData("arrived", "code"),
      include: bookingInclude,
    });

    return toDto(updated);
  });

  fastify.patch("/restaurant/bookings/:id", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const { id } = request.params as { id: string };
    const status = (request.body as { status?: unknown } | undefined)?.status;

    if (!MARKABLE_STATUSES.includes(status as MarkableStatus)) {
      return reply.code(400).send({ error: "invalid_status" });
    }

    const booking = await prisma.booking.findFirst({
      where: { id, slot: { offer: { restaurantId } } },
      include: { slot: true },
    });

    if (!booking) {
      return reply.code(404).send({ error: "booking_not_found" });
    }
    if (booking.status === "cancelled") {
      return reply.code(409).send({ error: "booking_cancelled" });
    }

    const window = visitWindow(booking.slot, now(), timeZone);
    if (status === "arrived" ? !window.canMarkArrived : !window.canMarkNoShow) {
      return reply.code(409).send({ error: "outside_visit_window" });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: markData(status as MarkableStatus, "manual"),
      include: bookingInclude,
    });

    return toDto(updated);
  });

  fastify.get("/restaurant/stats", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const query = request.query as { from?: unknown; days?: unknown };
    const from = parseDate(query.from);
    const days = Number(query.days ?? 7);

    if (!from || !Number.isInteger(days) || days < 1 || days > MAX_STATS_DAYS) {
      return reply.code(400).send({ error: "invalid_range" });
    }

    const to = addDays(from, days);
    const slots = await prisma.slot.findMany({
      where: { date: { gte: from, lt: to }, offer: { restaurantId } },
      select: {
        date: true,
        seatsTotal: true,
        seatsBooked: true,
        bookings: { select: { status: true, disputedAt: true } },
      },
    });

    const byDate = new Map<string, RestaurantDayStatsDto>();
    for (let i = 0; i < days; i++) {
      const date = toDateString(addDays(from, i));
      byDate.set(date, { date, seatsTotal: 0, seatsBooked: 0, arrived: 0, noShow: 0, disputed: 0 });
    }

    for (const slot of slots) {
      const day = byDate.get(toDateString(slot.date));
      if (!day) continue;
      day.seatsTotal += slot.seatsTotal;
      day.seatsBooked += slot.seatsBooked;
      for (const booking of slot.bookings) {
        if (booking.status !== "arrived" && booking.status !== "no_show") continue;
        // A disputed mark is neither a trusted visit nor a trusted no-show.
        if (booking.disputedAt) day.disputed += 1;
        else if (booking.status === "arrived") day.arrived += 1;
        else day.noShow += 1;
      }
    }

    return { days: [...byDate.values()] };
  });
};

export default restaurantBookingsRoutes;
