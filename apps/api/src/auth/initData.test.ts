import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyInitData } from "./initData.js";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS";

function buildInitData(
  fields: Record<string, string>,
  botToken: string = BOT_TOKEN,
): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function validFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    user: JSON.stringify({ id: 42, first_name: "Ada", username: "ada" }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    ...overrides,
  };
}

describe("verifyInitData", () => {
  it("accepts a correctly signed payload and parses the user", () => {
    const initDataRaw = buildInitData(validFields());

    const result = verifyInitData(initDataRaw, { botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.id).toBe(42);
      expect(result.data.user.username).toBe("ada");
    }
  });

  it("rejects a payload tampered with after signing", () => {
    const initDataRaw = buildInitData(validFields());
    const tampered = initDataRaw.replace("Ada", "Eve");

    const result = verifyInitData(tampered, { botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("rejects a payload signed with a different bot token", () => {
    const initDataRaw = buildInitData(validFields(), "999999:WRONG-TOKEN");

    const result = verifyInitData(initDataRaw, { botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("rejects a payload with no hash field", () => {
    const params = new URLSearchParams(validFields());

    const result = verifyInitData(params.toString(), { botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_hash");
    }
  });

  it("rejects an expired auth_date", () => {
    const tenHoursAgo = Math.floor(Date.now() / 1000) - 10 * 60 * 60;
    const initDataRaw = buildInitData(validFields({ auth_date: String(tenHoursAgo) }));

    const result = verifyInitData(initDataRaw, {
      botToken: BOT_TOKEN,
      maxAgeSeconds: 60 * 60, // 1 hour TTL
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  it("accepts a payload within the configured TTL", () => {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
    const initDataRaw = buildInitData(validFields({ auth_date: String(fiveMinutesAgo) }));

    const result = verifyInitData(initDataRaw, {
      botToken: BOT_TOKEN,
      maxAgeSeconds: 60 * 60,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a payload with an unparseable user field", () => {
    const initDataRaw = buildInitData(validFields({ user: "not-json" }));

    const result = verifyInitData(initDataRaw, { botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_user");
    }
  });
});
