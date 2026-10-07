/** Single time zone for all restaurants (MVP): slot times are wall-clock times in this zone. */
export const appTimeZone = process.env.APP_TIMEZONE ?? "Europe/Moscow";

export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`APP_TIMEZONE "${timeZone}" is not a valid IANA time zone`);
  }
}
