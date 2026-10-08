import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiGet } from "./client";

/**
 * Tiny stale-while-revalidate cache for GET requests. Navigating back to a
 * screen shows the last data instantly and refreshes it in the background,
 * instead of flashing a loader every time.
 */
interface Entry {
  data?: unknown;
  error?: unknown;
  fetchedAt: number;
  inflight?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function revalidate(path: string): Promise<void> {
  const previous = cache.get(path);
  if (previous?.inflight) return previous.inflight;

  const inflight = apiGet<unknown>(path)
    .then((data) => {
      cache.set(path, { data, fetchedAt: Date.now() });
    })
    .catch((error: unknown) => {
      // Keep showing stale data if we have it; only surface the error otherwise.
      cache.set(path, { data: previous?.data, error, fetchedAt: previous?.fetchedAt ?? 0 });
    })
    .finally(notify);

  cache.set(path, { ...previous, fetchedAt: previous?.fetchedAt ?? 0, inflight });
  notify();
  return inflight;
}

/** Refetches cached responses whose path starts with any of the prefixes. */
export function invalidate(...prefixes: string[]) {
  for (const path of cache.keys()) {
    if (prefixes.some((prefix) => path.startsWith(prefix))) {
      void revalidate(path);
    }
  }
}

const FRESH_FOR_MS = 15_000;

export type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; reload: () => void }
  | { status: "ready"; data: T; refreshing: boolean; reload: () => void };

export function useApi<T>(path: string): ApiState<T> {
  useSyncExternalStore(subscribe, () => version);

  useEffect(() => {
    const entry = cache.get(path);
    if (!entry || (!entry.inflight && Date.now() - entry.fetchedAt > FRESH_FOR_MS)) {
      void revalidate(path);
    }
  }, [path]);

  const reload = useCallback(() => {
    void revalidate(path);
  }, [path]);

  const entry = cache.get(path);
  if (entry?.data !== undefined) {
    return { status: "ready", data: entry.data as T, refreshing: Boolean(entry.inflight), reload };
  }
  if (entry?.error !== undefined && !entry.inflight) {
    return { status: "error", reload };
  }
  return { status: "loading" };
}
