import type { FastifyPluginAsync } from "fastify";
import type { RestaurantDetailDto } from "@app/shared";
import { prisma } from "@app/db";
import { appTimeZone } from "../config.js";
import { mapOfferToFeedItem } from "../offers/mapOfferToFeedItem.js";
import { localToday, onlyUpcomingSlots } from "../offers/upcomingSlots.js";

const HORIZON_DAYS = 14;

const restaurantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/restaurants/:id",
    { preHandler: (request, reply) => fastify.requireTelegramAuth(request, reply) },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const restaurant = await prisma.restaurant.findUnique({ where: { id } });
      if (!restaurant) {
        return reply.code(404).send({ error: "restaurant_not_found" });
      }

      const now = new Date();
      const today = localToday(now, appTimeZone);
      const horizonEnd = new Date(today);
      horizonEnd.setUTCDate(horizonEnd.getUTCDate() + HORIZON_DAYS);

      const offers = await prisma.offer.findMany({
        where: { restaurantId: id, active: true },
        include: {
          restaurant: { select: { name: true, imageUrl: true } },
          slots: {
            where: { date: { gte: today, lte: horizonEnd } },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const response: RestaurantDetailDto & { offers: ReturnType<typeof mapOfferToFeedItem>[] } = {
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurant.imageUrl ?? undefined,
        description: restaurant.description ?? undefined,
        offers: offers
          .map((offer) => ({ ...offer, slots: onlyUpcomingSlots(offer.slots, now, appTimeZone) }))
          .map(mapOfferToFeedItem),
      };

      return { restaurant: response, offers: response.offers };
    },
  );
};

export default restaurantsRoutes;
