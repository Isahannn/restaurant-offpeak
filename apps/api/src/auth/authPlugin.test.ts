import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import authPlugin from "./authPlugin.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

function buildInitData(fields: Record<string, string>): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function buildApp() {
  const app = Fastify();
  app.register(authPlugin, { botToken: BOT_TOKEN });
  app.get(
    "/protected",
    { preHandler: (request, reply) => app.requireTelegramAuth(request, reply) },
    async (request) => ({
      userId: request.telegramUser?.id,
    }),
  );
  return app;
}

describe("authPlugin", () => {
  it("returns 401 when the init data header is missing", async () => {
    const app = buildApp();

    const response = await app.inject({ method: "GET", url: "/protected" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_init_data" });
  });

  it("returns 401 when the init data signature is invalid", async () => {
    const app = buildApp();
    const initDataRaw = buildInitData({
      user: JSON.stringify({ id: 1 }),
      auth_date: String(Math.floor(Date.now() / 1000)),
    }).replace(/user=.*?&/, "user=tampered&");

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { "x-telegram-init-data": initDataRaw },
    });

    expect(response.statusCode).toBe(401);
  });

  it("attaches the verified telegram user and allows the request through", async () => {
    const app = buildApp();
    const initDataRaw = buildInitData({
      user: JSON.stringify({ id: 777, username: "ada" }),
      auth_date: String(Math.floor(Date.now() / 1000)),
    });

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { "x-telegram-init-data": initDataRaw },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: 777 });
  });
});
