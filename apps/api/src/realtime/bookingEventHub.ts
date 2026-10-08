import { EventEmitter } from "node:events";
import pg from "pg";

export interface BookingEvent {
  restaurantId: string;
  bookingId: string;
  type: "created" | "status_changed";
  status: string;
}

export interface BookingEventHub {
  /** Resolves once the first LISTEN is active. */
  ready: Promise<void>;
  subscribe(restaurantId: string, listener: (event: BookingEvent) => void): () => void;
  close(): Promise<void>;
}

const CHANNEL = "booking_events";
const MAX_RECONNECT_DELAY_MS = 30_000;

/** pg rejects Prisma-only query params such as `schema`. */
function toPgConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete("schema");
  return url.toString();
}

/**
 * Bridges Postgres NOTIFY (fired by the booking trigger, whoever wrote the row)
 * to in-process subscribers keyed by restaurant. One dedicated connection
 * serves every open panel; it reconnects with backoff if the database drops it.
 */
export function createBookingEventHub(
  databaseUrl: string,
  { log }: { log: (message: string) => void },
): BookingEventHub {
  const emitter = new EventEmitter();
  // One listener per open panel; the default cap of 10 is far too low.
  emitter.setMaxListeners(0);

  const connectionString = toPgConnectionString(databaseUrl);
  let client: pg.Client | null = null;
  let closed = false;
  let reconnectDelay = 1000;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  };

  async function connect(): Promise<void> {
    const next = new pg.Client({ connectionString });
    next.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      try {
        const event = JSON.parse(message.payload) as BookingEvent;
        if (event.restaurantId) emitter.emit(event.restaurantId, event);
      } catch {
        log("booking events: ignored malformed payload");
      }
    });
    next.on("error", (err) => {
      log(`booking events: connection error — ${err.message}`);
      void next.end().catch(() => {});
      if (client === next) client = null;
      scheduleReconnect();
    });

    try {
      await next.connect();
      await next.query(`LISTEN ${CHANNEL}`);
      if (closed) {
        await next.end();
        return;
      }
      client = next;
      reconnectDelay = 1000;
      markReady();
    } catch (err) {
      log(`booking events: connect failed — ${err instanceof Error ? err.message : String(err)}`);
      await next.end().catch(() => {});
      scheduleReconnect();
    }
  }

  void connect();

  return {
    ready,
    subscribe(restaurantId, listener) {
      emitter.on(restaurantId, listener);
      return () => {
        emitter.off(restaurantId, listener);
      };
    },
    async close() {
      closed = true;
      clearTimeout(reconnectTimer);
      emitter.removeAllListeners();
      await client?.end().catch(() => {});
      client = null;
    },
  };
}
