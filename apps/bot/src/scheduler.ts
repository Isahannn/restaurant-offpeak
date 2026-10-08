export interface ScheduledJob {
  name: string;
  /** Runs one pass; returns a short summary to log, or null when there was nothing to do. */
  run: (now: Date) => Promise<string | null>;
}

export interface SchedulerOptions {
  intervalMs: number;
  jobs: ScheduledJob[];
  log: (message: string) => void;
}

/**
 * Runs every job once immediately and then on each interval. A slow job never
 * overlaps itself, and one job failing does not stop the others.
 * Returns a function that stops the loop.
 */
export function startScheduler({ intervalMs, jobs, log }: SchedulerOptions): () => void {
  const running = new Set<string>();

  const runJob = async (job: ScheduledJob) => {
    if (running.has(job.name)) return;
    running.add(job.name);
    try {
      const summary = await job.run(new Date());
      if (summary) log(`${job.name}: ${summary}`);
    } catch (err) {
      // Prisma errors start with a blank line; trim so the log shows the actual reason.
      log(`${job.name}: failed — ${(err instanceof Error ? err.message : String(err)).trim()}`);
    } finally {
      running.delete(job.name);
    }
  };

  const tick = () => {
    for (const job of jobs) void runJob(job);
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}
