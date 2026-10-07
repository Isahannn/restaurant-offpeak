import {
  bindThemeParamsCssVars,
  init,
  mountThemeParams,
} from "@telegram-apps/sdk-react";

export function bootstrapTelegram(): void {
  try {
    init();
    mountThemeParams();
    bindThemeParamsCssVars();
  } catch {
    // Not running inside Telegram (e.g. local browser dev) — CSS fallback
    // values in tokens.css keep the app usable without the SDK.
  }
}