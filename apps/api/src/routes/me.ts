import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@app/db";

const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/me/role",
    { preHandler: (request, reply) => fastify.requireTelegramAuth(request, reply) },
    async (request) => {
      const staff = await prisma.restaurantStaff.findUnique({
        where: { telegramUserId: BigInt(request.telegramUser!.id) },
        include: { restaurant: { select: { name: true } } },
      });

      if (!staff) {
        return { role: "guest" as const };
      }

      return {
        role: "staff" as const,
        restaurantId: staff.restaurantId,
        restaurantName: staff.restaurant.name,
      };
    },
  );
};

export default meRoutes;
