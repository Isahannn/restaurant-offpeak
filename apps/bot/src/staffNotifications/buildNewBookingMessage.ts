import { localDateString } from "@app/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "сегодня" / "завтра" / "14 окт." for a slot date, relative to `now` in the restaurant's zone. */
export function dayLabel(slotDate: string, now: Date, timeZone: string): string {
  if (slotDate === localDateString(now, timeZone)) return "сегодня";
  if (slotDate === localDateString(new Date(now.getTime() + DAY_MS), timeZone)) return "завтра";
  return new Date(`${slotDate}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
}

export interface NewBookingMessageInput {
  day: string;
  startTime: string;
  offerTitle: string;
  discountPercent: number;
  partySize: number;
  code: string;
}

export function buildNewBookingMessage(input: NewBookingMessageInput): string {
  const discount = input.discountPercent > 0 ? `, скидка ${input.discountPercent}%` : "";

  return [
    `Новая бронь · ${input.day}, ${input.startTime}`,
    `${input.offerTitle}${discount}`,
    `Гостей: ${input.partySize} · код ${input.code}`,
  ].join("\n");
}
