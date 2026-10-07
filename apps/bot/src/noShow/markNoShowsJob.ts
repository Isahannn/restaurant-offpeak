import { prisma } from "@app/db";

export interface MarkNoShowsOptions {
  now: Date;
  /** IANA zone the slots' wall-clock times are expressed in. */
  timeZone: string;
  /** How long after the slot ends staff still have to mark the visit themselves. */
  graceMinutes: number;
}

/**
 * Bookings nobody marked by the end of the slot (plus a grace period) become
 * no-shows, so stats stay honest without staff ticking every table. Staff can
 * still flip one to "arrived" afterwards if they simply forgot.
 *
 * Returns the number of bookings marked.
 */
export async function markNoShows({ now, timeZone, graceMinutes }: MarkNoShowsOptions): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Booking" AS b
    SET "status" = 'no_show', "updatedAt" = ${now}::timestamptz
    FROM "Slot" AS s
    WHERE b."slotId" = s."id"
      AND b."status" IN ('pending', 'confirmed')
      AND (s."date" + s."endTime"::time) AT TIME ZONE ${timeZone}
          + make_interval(mins => ${graceMinutes}::int) <= ${now}::timestamptz
  `;
}
