import {
  bindThemeParamsCssVars,
  disableVerticalSwipes,
  expandViewport,
  init,
  mountMiniApp,
  mountSwipeBehavior,
  mountThemeParams,
  mountViewport,
  miniAppReady,
} from "@telegram-apps/sdk-react";

/** Runs a Telegram SDK call, ignoring failures outside Telegram or on old clients. */
function tryTg(fn: () => unknown): void {
  try {
    const result = fn();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // Not inside Telegram, or this client doesn't support the method.
  }
}

export function bootstrapTelegram(): void {
  try {
    init();
  } catch {
    // Not running inside Telegram (e.g. local browser dev) — CSS fallback
    // values in tokens.css keep the app usable without the SDK.
    return;
  }

  tryTg(() => {
    mountThemeParams();
    bindThemeParamsCssVars();
  });
  tryTg(mountMiniApp);
  tryTg(miniAppReady);
  // Full height from the start: feed and booking sheet need the room.
  tryTg(() => {
    const mounting = mountViewport();
    return Promise.resolve(mounting).then(() => expandViewport());
  });
  // Scrolling inside the booking sheet must not swipe the whole app closed.
  tryTg(() => {
    mountSwipeBehavior();
    disableVerticalSwipes();
  });
}
