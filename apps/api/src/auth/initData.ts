import { createHmac, timingSafeEqual } from "node:crypto";

export interface InitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  [key: string]: unknown;
}

export interface VerifiedInitData {
  user: InitDataUser;
  authDate: number;
  raw: Record<string, string>;
}

export type VerifyInitDataFailureReason =
  | "missing_hash"
  | "invalid_signature"
  | "missing_auth_date"
  | "expired"
  | "missing_user"
  | "invalid_user";

export type VerifyInitDataResult =
  | { ok: true; data: VerifiedInitData }
  | { ok: false; reason: VerifyInitDataFailureReason };

export interface VerifyInitDataOptions {
  botToken: string;
  /** Max allowed age of auth_date, in seconds. Defaults to 24h. */
  maxAgeSeconds?: number;
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

function computeHash(dataCheckString: string, botToken: string): string {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function verifyInitData(
  initDataRaw: string,
  options: VerifyInitDataOptions,
): VerifyInitDataResult {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, reason: "missing_hash" };
  }

  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    raw[key] = value;
  }

  const dataCheckString = Object.keys(raw)
    .sort()
    .map((key) => `${key}=${raw[key]}`)
    .join("\n");

  const expectedHash = computeHash(dataCheckString, options.botToken);
  if (!safeEqualHex(expectedHash, hash)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const authDateRaw = raw.auth_date;
  if (!authDateRaw) {
    return { ok: false, reason: "missing_auth_date" };
  }
  const authDate = Number(authDateRaw);
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: "expired" };
  }

  const userRaw = raw.user;
  if (!userRaw) {
    return { ok: false, reason: "missing_user" };
  }

  let user: InitDataUser;
  try {
    const parsed = JSON.parse(userRaw);
    if (typeof parsed !== "object" || parsed === null || typeof parsed.id !== "number") {
      return { ok: false, reason: "invalid_user" };
    }
    user = parsed as InitDataUser;
  } catch {
    return { ok: false, reason: "invalid_user" };
  }

  return { ok: true, data: { user, authDate, raw } };
}
