export interface TimeWindow {
  startTime: string;
  endTime: string;
}

export interface OfferScheduleInput {
  /** 0 (Sunday) - 6 (Saturday), matching Date#getUTCDay(). */
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  discountPercent: number;
  /** Sub-ranges within [startTime, endTime) where discountPercent applies.
   * An empty array means the whole window is discounted (convenience default
   * for offers that don't need a partial-day discount). */
  discountWindows: TimeWindow[];
}

export interface SlotGenerationRange {
  /** "YYYY-MM-DD", inclusive. */
  fromDate: string;
  /** Number of days to generate, starting at fromDate. */
  days: number;
}

export interface GeneratedSlot {
  date: string;
  startTime: string;
  endTime: string;
  seatsTotal: number;
  discountPercent: number;
}

const HOUR_IN_MINUTES = 60;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isWithinAnyWindow(
  blockStartMinutes: number,
  blockEndMinutes: number,
  windows: TimeWindow[],
): boolean {
  return windows.some((window) => {
    const windowStart = parseTimeToMinutes(window.startTime);
    const windowEnd = parseTimeToMinutes(window.endTime);
    return blockStartMinutes >= windowStart && blockEndMinutes <= windowEnd;
  });
}

function hourlyBlocksForDay(
  offer: OfferScheduleInput,
): Array<{ startTime: string; endTime: string; discountPercent: number }> {
  const startMinutes = parseTimeToMinutes(offer.startTime);
  const endMinutes = parseTimeToMinutes(offer.endTime);
  const blocks: Array<{ startTime: string; endTime: string; discountPercent: number }> = [];

  for (let cursor = startMinutes; cursor + HOUR_IN_MINUTES <= endMinutes; cursor += HOUR_IN_MINUTES) {
    const blockEnd = cursor + HOUR_IN_MINUTES;
    const discounted =
      offer.discountWindows.length === 0 || isWithinAnyWindow(cursor, blockEnd, offer.discountWindows);

    blocks.push({
      startTime: formatMinutesToTime(cursor),
      endTime: formatMinutesToTime(blockEnd),
      discountPercent: discounted ? offer.discountPercent : 0,
    });
  }

  return blocks;
}

export function computeSlotsForOffer(
  offer: OfferScheduleInput,
  range: SlotGenerationRange,
): GeneratedSlot[] {
  if (offer.daysOfWeek.length === 0 || range.days <= 0) {
    return [];
  }

  const daysOfWeek = new Set(offer.daysOfWeek);
  const blocks = hourlyBlocksForDay(offer);
  const slots: GeneratedSlot[] = [];
  const cursor = new Date(`${range.fromDate}T00:00:00.000Z`);

  for (let i = 0; i < range.days; i++) {
    if (daysOfWeek.has(cursor.getUTCDay())) {
      const date = toDateString(cursor);
      for (const block of blocks) {
        slots.push({
          date,
          startTime: block.startTime,
          endTime: block.endTime,
          seatsTotal: offer.seatsPerSlot,
          discountPercent: block.discountPercent,
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}
