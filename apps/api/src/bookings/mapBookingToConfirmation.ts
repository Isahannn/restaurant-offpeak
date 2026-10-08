import type { BookingConfirmationDto } from "@app/shared";
import type { BookingWithRelations } from "./createBooking.js";

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function mapBookingToConfirmation(booking: BookingWithRelations): BookingConfirmationDto {
  return {
    id: booking.id,
    slotId: booking.slotId,
    guestTelegramId: booking.guestTelegramId.toString(),
    partySize: booking.partySize,
    code: booking.code,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    slotDate: toDateString(booking.slot.date),
    slotStartTime: booking.slot.startTime,
    slotEndTime: booking.slot.endTime,
    offerTitle: booking.slot.offer.title,
    restaurantName: booking.slot.offer.restaurant.name,
    disputed: booking.disputedAt !== null,
  };
}
