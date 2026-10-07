import Fastify from "fastify";
import authPlugin from "./auth/authPlugin.js";
import { appTimeZone, assertValidTimeZone } from "./config.js";
import staffPlugin from "./auth/staffPlugin.js";
import bookingsRoutes from "./routes/bookings.js";
import meRoutes from "./routes/me.js";
import offersRoutes from "./routes/offers.js";
import restaurantBookingsRoutes from "./routes/restaurantBookings.js";
import restaurantOffersRoutes from "./routes/restaurantOffers.js";
import restaurantsRoutes from "./routes/restaurants.js";

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN is not set");
}

assertValidTimeZone(appTimeZone);

const app = Fastify({ logger: true });

await app.register(authPlugin, { botToken });
await app.register(offersRoutes);
await app.register(bookingsRoutes);
await app.register(restaurantsRoutes);
await app.register(staffPlugin);
await app.register(meRoutes);
await app.register(restaurantOffersRoutes);
await app.register(restaurantBookingsRoutes);

app.get("/health", async () => ({ status: "ok" }));

app.get(
  "/me",
  { preHandler: (request, reply) => app.requireTelegramAuth(request, reply) },
  async (request) => ({ user: request.telegramUser }),
);

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
