import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@app/db";

export interface RestaurantStaffContext {
  restaurantId: string;
  role: "owner" | "staff";
}

declare module "fastify" {
  interface FastifyRequest {
    restaurantStaff?: RestaurantStaffContext;
  }
  interface FastifyInstance {
    requireRestaurantStaff: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const staffPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("restaurantStaff", undefined);

  fastify.decorate("requireRestaurantStaff", async function requireRestaurantStaff(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const telegramUser = request.telegramUser;
    if (!telegramUser) {
      await reply.code(401).send({ error: "missing_init_data" });
      return;
    }

    const staff = await prisma.restaurantStaff.findUnique({
      where: { telegramUserId: BigInt(telegramUser.id) },
    });

    if (!staff) {
      await reply.code(403).send({ error: "not_staff" });
      return;
    }

    request.restaurantStaff = { restaurantId: staff.restaurantId, role: staff.role };
  });
};

export default fp(staffPlugin, { name: "restaurant-staff" });
