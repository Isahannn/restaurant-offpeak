import { useEffect, useRef } from "react";
import { getInitDataRaw } from "./client";

export interface BookingEvent {
  restaurantId: string;
  bookingId: string;
  type: "created" | "status_changed";
  status: string;
}

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
/**
 * The server pings every 15s. If nothing arrives for this long the stream is
 * dead even if the socket looks open — a proxy (Vite, ngrok, nginx) can keep
 * the client side alive after the API itself went away — so drop and reconnect.
 */
const SILENCE_TIMEOUT_MS = 40_000;

/**
 * Reads the restaurant's Server-Sent Events stream. Uses fetch instead of
 * EventSource because EventSource cannot send the Telegram auth header.
 * Reconnects with backoff until the returned function is called.
 */
export function subscribeToBookingEvents(
  onEvent: (event: BookingEvent) => void,
  onReconnect?: () => void,
): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryMs = INITIAL_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectedBefore = false;

  const dispatch = (block: string) => {
    let eventName = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (eventName !== "booking" || data.length === 0) return;
    try {
      onEvent(JSON.parse(data.join("\n")) as BookingEvent);
    } catch {
      // Ignore a malformed event rather than dropping the stream.
    }
  };

  const connect = async () => {
    const attempt = new AbortController();
    controller = attempt;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => attempt.abort(), SILENCE_TIMEOUT_MS);
    };
    const initData = getInitDataRaw();
    try {
      armWatchdog();
      const response = await fetch("/api/restaurant/events", {
        headers: initData ? { "x-telegram-init-data": initData } : {},
        signal: attempt.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error(`events stream: HTTP ${response.status}`);

      // After a drop we may have missed events: let the caller resync once.
      if (connectedBefore) onReconnect?.();
      connectedBefore = true;
      retryMs = INITIAL_RETRY_MS;

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        armWatchdog();
        buffer += value;
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          dispatch(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // Network drop, proxy timeout or abort — handled below.
    } finally {
      clearTimeout(watchdog);
    }
    if (stopped) return;
    retryTimer = setTimeout(() => void connect(), retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  };

  void connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    controller?.abort();
  };
}

/** Subscribes for the component's lifetime; handlers may change without reconnecting. */
export function useBookingEvents(onEvent: (event: BookingEvent) => void, onReconnect?: () => void) {
  const handlers = useRef({ onEvent, onReconnect });
  useEffect(() => {
    handlers.current = { onEvent, onReconnect };
  });

  useEffect(
    () =>
      subscribeToBookingEvents(
        (event) => handlers.current.onEvent(event),
        () => handlers.current.onReconnect?.(),
      ),
    [],
  );
}
