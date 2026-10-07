import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { verifyInitData, type InitDataUser } from "./initData.js";

declare module "fastify" {
  interface FastifyRequest {
    telegramUser?: InitDataUser;
  }
  interface FastifyInstance {
    requireTelegramAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  botToken: string;
  maxAgeSeconds?: number;
  headerName?: string;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  const headerName = (opts.headerName ?? "x-telegram-init-data").toLowerCase();

  fastify.decorateRequest("telegramUser", undefined);

  fastify.decorate("requireTelegramAuth", async function requireTelegramAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const header = request.headers[headerName];
    const initDataRaw = Array.isArray(header) ? header[0] : header;

    if (!initDataRaw) {
      await reply.code(401).send({ error: "missing_init_data" });
      return;
    }

    const result = verifyInitData(initDataRaw, {
      botToken: opts.botToken,
      maxAgeSeconds: opts.maxAgeSeconds,
    });

    if (!result.ok) {
      await reply.code(401).send({ error: result.reason });
      return;
    }

    request.telegramUser = result.data.user;
  });
};

export default fp(authPlugin, { name: "telegram-auth" });
