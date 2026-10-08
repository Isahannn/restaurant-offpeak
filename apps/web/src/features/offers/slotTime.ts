import type { SlotDto } from "@app/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_WINDOW_MS = 2 * 60 * 60 * 1000;

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Slot start on the device clock. Display-only: the server enforces real cut-offs. */
export function slotStartMs(slot: Pick<SlotDto, "date" | "startTime">): number {
  const [y, m, d] = slot.date.split("-").map(Number);
  const [hh, mm] = slot.startTime.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

export const seatsLeft = (slot: SlotDto) => Math.max(0, slot.seatsTotal - slot.seatsBooked);

export const isBookable = (slot: SlotDto, now: number) => seatsLeft(slot) > 0 && slotStartMs(slot) > now;

export type TimeFilter = "now" | "today" | "tomorrow" | "all";

export const TIME_FILTERS: Array<{ id: TimeFilter; label: string }> = [
  { id: "now", label: "Сейчас" },
  { id: "today", label: "Сегодня" },
  { id: "tomorrow", label: "Завтра" },
  { id: "all", label: "Все" },
];

/** Slots matching a feed filter: "now" means starting within the next two hours. */
export function slotsForFilter(slots: SlotDto[], filter: TimeFilter, now: number): SlotDto[] {
  const today = localDateString(new Date(now));
  const tomorrow = localDateString(new Date(now + DAY_MS));
  return slots.filter((slot) => {
    if (!isBookable(slot, now)) return false;
    switch (filter) {
      case "now":
        return slotStartMs(slot) - now <= NOW_WINDOW_MS;
      case "today":
        return slot.date === today;
      case "tomorrow":
        return slot.date === tomorrow;
      default:
        return true;
    }
  });
}

/** "сегодня" / "завтра" / "пт, 10 окт." */
export function dayLabel(date: string, now: number): string {
  if (date === localDateString(new Date(now))) return "сегодня";
  if (date === localDateString(new Date(now + DAY_MS))) return "завтра";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

export function groupByDate(slots: SlotDto[]): Array<{ date: string; slots: SlotDto[] }> {
  const groups = new Map<string, SlotDto[]>();
  for (const slot of slots) {
    const list = groups.get(slot.date);
    if (list) list.push(slot);
    else groups.set(slot.date, [slot]);
  }
  return [...groups].map(([date, list]) => ({ date, slots: list }));
}
