import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@app/db";
import { createBooking } from "../bookings/createBooking.js";
import { mapBookingToConfirmation } from "../bookings/mapBookingToConfirmation.js";

interface CreateBookingBody {
  slotId?: unknown;
  partySize?: unknown;
}

const bookingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/bookings",
    { preHandler: (request, reply) => fastify.requireTelegramAuth(request, reply) },
    async (request, reply) => {
      const body = request.body as CreateBookingBody;

      if (typeof body.slotId !== "string" || typeof body.partySize !== "number") {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const result = await createBooking({
        slotId: body.slotId,
        partySize: body.partySize,
        guestTelegramId: BigInt(request.telegramUser!.id),
      });

      if (!result.ok) {
        const statusByReason = {
          invalid_party_size: 400,
          slot_not_found: 404,
          slot_started: 409,
          sold_out: 409,
        } as const;
        return reply.code(statusByReason[result.reason]).send({ error: result.reason });
      }

      return reply.code(201).send(mapBookingToConfirmation(result.booking));
    },
  );

  fastify.get(
    "/bookings/me",
    { preHandler: (request, reply) => fastify.requireTelegramAuth(request, reply) },
    async (request) => {
      const bookings = await prisma.booking.findMany({
        where: { guestTelegramId: BigInt(request.telegramUser!.id) },
        include: {
          slot: {
            include: {
              offer: {
                include: { restaurant: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { bookings: bookings.map(mapBookingToConfirmation) };
    },
  );
};

export default bookingsRoutes;
