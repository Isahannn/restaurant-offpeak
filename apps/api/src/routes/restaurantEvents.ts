import type { FastifyPluginAsync } from "fastify";
import type { BookingEventHub } from "../realtime/bookingEventHub.js";

interface RestaurantEventsOptions {
  hub: BookingEventHub;
  /** Comment lines keep proxies (ngrok, nginx) from closing an idle stream. */
  heartbeatMs?: number;
}

/** Must stay well under the web client's 40s silence timeout. */
const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * Server-Sent Events stream of the staff member's own restaurant bookings.
 * SSE rather than WebSocket: updates only flow server -> panel, and plain HTTP
 * passes through ngrok and the Vite proxy untouched.
 */
const restaurantEventsRoutes: FastifyPluginAsync<RestaurantEventsOptions> = async (fastify, { hub, heartbeatMs }) => {
  fastify.get(
    "/restaurant/events",
    {
      preHandler: [
        (request, reply) => fastify.requireTelegramAuth(request, reply),
        (request, reply) => fastify.requireRestaurantStaff(request, reply),
      ],
    },
    async (request, reply) => {
      const restaurantId = request.restaurantStaff!.restaurantId;

      // Take over the raw socket: the response never "completes", so it must
      // bypass Fastify's serialisation and the compression hook.
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      // `retry` tells the client how long to wait before reconnecting.
      res.write("retry: 3000\n: connected\n\n");

      const unsubscribe = hub.subscribe(restaurantId, (event) => {
        res.write(`event: booking\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => res.write(": ping\n\n"), heartbeatMs ?? DEFAULT_HEARTBEAT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.raw.on("close", cleanup);
      res.on("error", cleanup);
    },
  );
};

export default restaurantEventsRoutes;
