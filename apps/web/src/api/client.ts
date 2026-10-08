import { retrieveLaunchParams } from "@telegram-apps/sdk-react";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

export function getInitDataRaw(): string | undefined {
  // The official bridge script (window.Telegram.WebApp) is always present inside
  // real Telegram clients and reflects the current launch data reliably. Prefer
  // it over the SDK's retrieveLaunchParams(), which caches its result in
  // sessionStorage and can miss updates.
  const fromBridge = window.Telegram?.WebApp?.initData;
  if (fromBridge) return fromBridge;

  try {
    return retrieveLaunchParams().initDataRaw;
  } catch {
    return undefined;
  }
}

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}

async function throwApiError(method: string, path: string, response: Response): Promise<never> {
  let reason: string | undefined;
  try {
    const body = (await response.json()) as { error?: string };
    reason = body.error;
  } catch {
    // response had no JSON body
  }
  throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`, reason);
}

export async function apiGet<T>(path: string): Promise<T> {
  const initDataRaw = getInitDataRaw();

  const response = await fetch(`/api${path}`, {
    headers: initDataRaw ? { "x-telegram-init-data": initDataRaw } : {},
  });

  if (!response.ok) {
    await throwApiError("GET", path, response);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const initDataRaw = getInitDataRaw();

  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(initDataRaw ? { "x-telegram-init-data": initDataRaw } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await throwApiError("POST", path, response);
  }

  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const initDataRaw = getInitDataRaw();

  const response = await fetch(`/api${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(initDataRaw ? { "x-telegram-init-data": initDataRaw } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await throwApiError("PATCH", path, response);
  }

  return response.json() as Promise<T>;
}
