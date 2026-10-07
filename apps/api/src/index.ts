import compress from "@fastify/compress";
import Fastify from "fastify";
import authPlugin from "./auth/authPlugin.js";
import { localDateString } from "@app/shared";
import { appTimeZone, assertValidTimeZone, slotHorizonDays } from "./config.js";
import { generateSlotsJob } from "./offers/generateSlotsJob.js";
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

// JSON slot lists compress ~10x; skip tiny bodies where gzip only adds overhead.
await app.register(compress, { threshold: 1024 });
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

// Slots are materialized a fixed horizon ahead; keep extending it so offers never
// run dry. Idempotent (skipDuplicates), so restarts and overlapping runs are safe.
const SLOT_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const refreshSlots = async () => {
  try {
    const created = await generateSlotsJob({
      horizonDays: slotHorizonDays,
      fromDate: localDateString(new Date(), appTimeZone),
    });
    if (created > 0) app.log.info({ created }, "slot horizon extended");
  } catch (err) {
    app.log.error(err, "slot generation failed");
  }
};
void refreshSlots();
setInterval(refreshSlots, SLOT_REFRESH_INTERVAL_MS);

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
