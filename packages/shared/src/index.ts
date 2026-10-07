export type BookingStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "no_show"
  | "cancelled";

export interface OfferDto {
  id: string;
  restaurantId: string;
  title: string;
  discountPercent: number;
  exceptions: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  active: boolean;
}

export interface SlotDto {
  id: string;
  offerId: string;
  date: string;
  startTime: string;
  endTime: string;
  seatsTotal: number;
  seatsBooked: number;
  discountPercent: number;
}

export interface OfferFeedItemDto extends OfferDto {
  restaurantName: string;
  restaurantImageUrl?: string;
  slots: SlotDto[];
}

export interface DiscountWindowDto {
  startTime: string;
  endTime: string;
}

export interface OfferAdminDto extends OfferDto {
  discountWindows: DiscountWindowDto[];
}

export interface RestaurantDetailDto {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  offers: OfferFeedItemDto[];
}

export interface BookingDto {
  id: string;
  slotId: string;
  guestTelegramId: string;
  partySize: number;
  code: string;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingConfirmationDto extends BookingDto {
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  offerTitle: string;
  restaurantName: string;
}

export interface RestaurantBookingDto {
  id: string;
  code: string;
  partySize: number;
  status: BookingStatus;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  offerTitle: string;
  discountPercent: number;
}

export interface RestaurantDayStatsDto {
  date: string;
  seatsTotal: number;
  seatsBooked: number;
  arrived: number;
  noShow: number;
}

export { localDateString, slotStartInstant } from "./time.js";
