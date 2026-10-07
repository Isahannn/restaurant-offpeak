import type { OfferFeedItemDto, SlotDto } from "@app/shared";

export interface SlotWithDate {
  id: string;
  offerId: string;
  date: Date;
  startTime: string;
  endTime: string;
  seatsTotal: number;
  seatsBooked: number;
  discountPercent: number;
}

export interface OfferWithRelations {
  id: string;
  restaurantId: string;
  restaurant: { name: string; imageUrl: string | null };
  title: string;
  discountPercent: number;
  exceptions: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  active: boolean;
  slots: SlotWithDate[];
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapSlot(slot: SlotWithDate): SlotDto {
  return {
    id: slot.id,
    offerId: slot.offerId,
    date: toDateString(slot.date),
    startTime: slot.startTime,
    endTime: slot.endTime,
    seatsTotal: slot.seatsTotal,
    seatsBooked: slot.seatsBooked,
    discountPercent: slot.discountPercent,
  };
}

export function mapOfferToFeedItem(offer: OfferWithRelations): OfferFeedItemDto {
  return {
    id: offer.id,
    restaurantId: offer.restaurantId,
    restaurantName: offer.restaurant.name,
    restaurantImageUrl: offer.restaurant.imageUrl ?? undefined,
    title: offer.title,
    discountPercent: offer.discountPercent,
    exceptions: offer.exceptions,
    daysOfWeek: offer.daysOfWeek,
    startTime: offer.startTime,
    endTime: offer.endTime,
    seatsPerSlot: offer.seatsPerSlot,
    active: offer.active,
    slots: offer.slots.map(mapSlot),
  };
}
