import { Prisma, prisma } from "@app/db";

export interface MarkNoShowsOptions {
  now: Date;
  /** IANA zone the slots' wall-clock times are expressed in. */
  timeZone: string;
  /** How long after the slot ends staff still have to mark the visit themselves. */
  graceMinutes: number;
  /**
   * Limit the sweep to one restaurant. The bot never passes it; tests must,
   * because they share the database with the running app and an unscoped sweep
   * with a far-future clock would mark every real booking as a no-show.
   */
  restaurantId?: string;
}

/**
 * Bookings nobody marked by the end of the slot (plus a grace period) become
 * no-shows, so stats stay honest without staff ticking every table. Staff can
 * still flip one to "arrived" afterwards if they simply forgot.
 *
 * Returns the number of bookings marked.
 */
export async function markNoShows({ now, timeZone, graceMinutes, restaurantId }: MarkNoShowsOptions): Promise<number> {
  const scope = restaurantId
    ? Prisma.sql`AND s."offerId" IN (SELECT "id" FROM "Offer" WHERE "restaurantId" = ${restaurantId})`
    : Prisma.empty;

  return prisma.$executeRaw`
    UPDATE "Booking" AS b
    SET "status" = 'no_show', "updatedAt" = ${now}::timestamptz
    FROM "Slot" AS s
    WHERE b."slotId" = s."id"
      AND b."status" IN ('pending', 'confirmed')
      AND (s."date" + s."endTime"::time) AT TIME ZONE ${timeZone}
          + make_interval(mins => ${graceMinutes}::int) <= ${now}::timestamptz
      ${scope}
  `;
}
