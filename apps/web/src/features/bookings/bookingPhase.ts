import type { BookingConfirmationDto } from "@app/shared";

export type Phase = "upcoming" | "in_progress" | "past";

function slotInstant(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

/** Device-local timing, used only for display; the server enforces the real rules. */
export function bookingPhase(booking: BookingConfirmationDto, now: number): Phase {
  if (slotInstant(booking.slotDate, booking.slotStartTime) > now) return "upcoming";
  if (slotInstant(booking.slotDate, booking.slotEndTime) > now) return "in_progress";
  return "past";
}
