/** Single time zone for all restaurants (MVP): slot times are wall-clock times in this zone. */
export const appTimeZone = process.env.APP_TIMEZONE ?? "Europe/Moscow";

/** How many days ahead bookable slots are materialized from active offers. */
export const slotHorizonDays = Number(process.env.SLOT_GENERATION_HORIZON_DAYS ?? 14);

export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`APP_TIMEZONE "${timeZone}" is not a valid IANA time zone`);
  }
}
