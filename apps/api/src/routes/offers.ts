import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@app/db";
import { appTimeZone } from "../config.js";
import { mapOfferToFeedItem } from "../offers/mapOfferToFeedItem.js";
import { localToday, onlyUpcomingSlots } from "../offers/upcomingSlots.js";

const DEFAULT_HORIZON_DAYS = 14;

const offersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/offers",
    { preHandler: (request, reply) => fastify.requireTelegramAuth(request, reply) },
    async () => {
      const now = new Date();
      const today = localToday(now, appTimeZone);
      const horizonEnd = new Date(today);
      horizonEnd.setUTCDate(horizonEnd.getUTCDate() + DEFAULT_HORIZON_DAYS);

      const offers = await prisma.offer.findMany({
        where: { active: true },
        include: {
          restaurant: { select: { name: true, imageUrl: true } },
          slots: {
            where: { date: { gte: today, lte: horizonEnd } },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { offers: offers
          .map((offer) => ({ ...offer, slots: onlyUpcomingSlots(offer.slots, now, appTimeZone) }))
          .map(mapOfferToFeedItem) };
    },
  );
};

export default offersRoutes;
