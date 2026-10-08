import type { FastifyPluginAsync } from "fastify";
import type { OfferAdminDto } from "@app/shared";
import { prisma } from "@app/db";
import { localDateString } from "@app/shared";
import { appTimeZone, slotHorizonDays } from "../config.js";
import { applyOfferSchedule } from "../offers/applyOfferSchedule.js";
import { generateSlotsJob } from "../offers/generateSlotsJob.js";


interface DiscountWindowInput {
  startTime?: unknown;
  endTime?: unknown;
}

interface CreateOfferBody {
  title?: unknown;
  discountPercent?: unknown;
  exceptions?: unknown;
  daysOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  seatsPerSlot?: unknown;
  discountWindows?: unknown;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ValidOfferInput {
  title: string;
  discountPercent: number;
  exceptions: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  discountWindows: Array<{ startTime: string; endTime: string }>;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function isValidDiscountWindow(w: unknown): w is { startTime: string; endTime: string } {
  const window = w as DiscountWindowInput;
  return isTime(window?.startTime) && isTime(window?.endTime) && window.startTime < window.endTime;
}

function validateCreateOfferBody(body: CreateOfferBody): { ok: true; value: ValidOfferInput } | { ok: false } {
  if (
    typeof body.title !== "string" ||
    body.title.trim() === "" ||
    typeof body.discountPercent !== "number" ||
    !Number.isInteger(body.discountPercent) ||
    body.discountPercent < 1 ||
    body.discountPercent > 90 ||
    !Array.isArray(body.exceptions) ||
    !body.exceptions.every((e) => typeof e === "string") ||
    !Array.isArray(body.daysOfWeek) ||
    body.daysOfWeek.length === 0 ||
    !body.daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
    !isTime(body.startTime) ||
    !isTime(body.endTime) ||
    body.startTime >= body.endTime ||
    typeof body.seatsPerSlot !== "number" ||
    !Number.isInteger(body.seatsPerSlot) ||
    body.seatsPerSlot < 1 ||
    !Array.isArray(body.discountWindows) ||
    !body.discountWindows.every(isValidDiscountWindow)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      title: body.title.trim(),
      discountPercent: body.discountPercent,
      exceptions: (body.exceptions as string[]).map((e) => e.trim()).filter(Boolean),
      daysOfWeek: [...new Set(body.daysOfWeek as number[])].sort(),
      startTime: body.startTime,
      endTime: body.endTime,
      seatsPerSlot: body.seatsPerSlot,
      discountWindows: body.discountWindows as Array<{ startTime: string; endTime: string }>,
    },
  };
}

function toOfferAdminDto(offer: {
  id: string;
  restaurantId: string;
  title: string;
  discountPercent: number;
  exceptions: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  active: boolean;
  discountWindows: Array<{ startTime: string; endTime: string }>;
}): OfferAdminDto {
  return {
    id: offer.id,
    restaurantId: offer.restaurantId,
    title: offer.title,
    discountPercent: offer.discountPercent,
    exceptions: offer.exceptions,
    daysOfWeek: offer.daysOfWeek,
    startTime: offer.startTime,
    endTime: offer.endTime,
    seatsPerSlot: offer.seatsPerSlot,
    active: offer.active,
    discountWindows: offer.discountWindows.map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
  };
}

const restaurantOffersRoutes: FastifyPluginAsync = async (fastify) => {
  const staffPreHandlers = [
    (request: Parameters<typeof fastify.requireTelegramAuth>[0], reply: Parameters<typeof fastify.requireTelegramAuth>[1]) =>
      fastify.requireTelegramAuth(request, reply),
    (request: Parameters<typeof fastify.requireRestaurantStaff>[0], reply: Parameters<typeof fastify.requireRestaurantStaff>[1]) =>
      fastify.requireRestaurantStaff(request, reply),
  ];

  fastify.get("/restaurant/offers", { preHandler: staffPreHandlers }, async (request) => {
    const restaurantId = request.restaurantStaff!.restaurantId;

    const offers = await prisma.offer.findMany({
      where: { restaurantId },
      include: { discountWindows: true },
      orderBy: { createdAt: "desc" },
    });

    return { offers: offers.map(toOfferAdminDto) };
  });

  fastify.post("/restaurant/offers", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const parsed = validateCreateOfferBody(request.body as CreateOfferBody);

    if (!parsed.ok) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const { discountWindows, ...offerFields } = parsed.value;

    const offer = await prisma.offer.create({
      data: {
        restaurantId,
        active: true,
        ...offerFields,
        discountWindows: { create: discountWindows },
      },
      include: { discountWindows: true },
    });

    await generateSlotsJob({
      horizonDays: slotHorizonDays,
      fromDate: localDateString(new Date(), appTimeZone),
      offerId: offer.id,
    });

    return reply.code(201).send(toOfferAdminDto(offer));
  });

  fastify.patch("/restaurant/offers/:id", { preHandler: staffPreHandlers }, async (request, reply) => {
    const restaurantId = request.restaurantStaff!.restaurantId;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as CreateOfferBody & { active?: unknown };

    const offer = await prisma.offer.findFirst({ where: { id, restaurantId } });
    if (!offer) {
      return reply.code(404).send({ error: "offer_not_found" });
    }

    // Toggle only: { active }.
    if (body.title === undefined) {
      if (typeof body.active !== "boolean") {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const updated = await prisma.offer.update({
        where: { id },
        data: { active: body.active },
        include: { discountWindows: true },
      });
      return toOfferAdminDto(updated);
    }

    // Full edit: same rules as creating an offer.
    const parsed = validateCreateOfferBody(body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const { discountWindows, ...offerFields } = parsed.value;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.discountWindow.deleteMany({ where: { offerId: id } });
      return tx.offer.update({
        where: { id },
        data: { ...offerFields, discountWindows: { create: discountWindows } },
        include: { discountWindows: true },
      });
    });

    const schedule = await applyOfferSchedule({
      offerId: id,
      previousSeatsPerSlot: offer.seatsPerSlot,
      now: new Date(),
      timeZone: appTimeZone,
      horizonDays: slotHorizonDays,
    });

    return { ...toOfferAdminDto(updated), schedule };
  });
};

export default restaurantOffersRoutes;
