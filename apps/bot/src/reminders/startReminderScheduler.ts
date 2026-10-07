import { runReminderTick, type ReminderTickOptions } from "./reminderJob.js";

const TICK_INTERVAL_MS = 60 * 1000;

export type ReminderSchedulerOptions = Omit<ReminderTickOptions, "now"> & {
  log: (message: string) => void;
};

/** Runs a reminder tick every minute; returns a function that stops the loop. */
export function startReminderScheduler(options: ReminderSchedulerOptions): () => void {
  const { log, ...tickOptions } = options;
  let running = false;

  const tick = async () => {
    // A slow tick (many reminders, Telegram rate limits) must not overlap the next one.
    if (running) return;
    running = true;
    try {
      const result = await runReminderTick({ ...tickOptions, now: new Date() });
      if (result.sent > 0 || result.failed > 0) {
        log(`reminders: sent ${result.sent}, failed ${result.failed}`);
      }
    } catch (err) {
      log(`reminders: tick failed — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  return () => clearInterval(timer);
}
