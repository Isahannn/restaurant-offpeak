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
  /** The guest disputed how their visit was marked. */
  disputed?: boolean;
}

export type CheckInMethod = "code" | "manual";

export interface RestaurantBookingDto {
  id: string;
  /** Masked (e.g. "••••AB"): staff must get the full code from the guest to check them in. */
  codeHint: string;
  partySize: number;
  status: BookingStatus;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  offerTitle: string;
  discountPercent: number;
  checkInMethod: CheckInMethod | null;
  /** The guest says the arrived / no-show mark is wrong. */
  disputed: boolean;
  /** Whether "arrived" / "no-show" may be set right now (visit window). */
  canMarkArrived: boolean;
  canMarkNoShow: boolean;
}

export interface RestaurantDayStatsDto {
  date: string;
  seatsTotal: number;
  seatsBooked: number;
  arrived: number;
  noShow: number;
  /** Visit marks the guest disputed; not counted in arrived / noShow. */
  disputed: number;
}

export interface RestaurantSlotDto {
  id: string;
  offerTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  seatsTotal: number;
  seatsBooked: number;
  /** The offer's usual capacity, used when reopening a closed slot. */
  defaultSeats: number;
  discountPercent: number;
  /** Started slots can no longer be edited. */
  started: boolean;
}

export { localDateString, slotStartInstant } from "./time.js";
