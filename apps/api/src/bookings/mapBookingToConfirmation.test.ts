import { describe, expect, it } from "vitest";
import { mapBookingToConfirmation } from "./mapBookingToConfirmation.js";
import type { BookingWithRelations } from "./createBooking.js";

function buildBooking(): BookingWithRelations {
  return {
    id: "booking_1",
    slotId: "slot_1",
    guestTelegramId: 999n,
    partySize: 2,
    code: "AB23CD",
    status: "confirmed",
    reminderSentAt: null,
    createdAt: new Date("2026-10-04T12:00:00.000Z"),
    updatedAt: new Date("2026-10-04T12:00:00.000Z"),
    slot: {
      id: "slot_1",
      offerId: "offer_1",
      date: new Date("2026-10-06T00:00:00.000Z"),
      startTime: "12:00",
      endTime: "14:00",
      seatsTotal: 8,
      seatsBooked: 2,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      offer: {
        id: "offer_1",
        restaurantId: "rest_1",
        title: "Lunch happy hour",
        discountPercent: 25,
        exceptions: [],
        daysOfWeek: [1, 3, 5],
        startTime: "12:00",
        endTime: "14:00",
        seatsPerSlot: 8,
        active: true,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        restaurant: {
          id: "rest_1",
          name: "Demo Trattoria",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      },
    },
  } as unknown as BookingWithRelations;
}

describe("mapBookingToConfirmation", () => {
  it("flattens booking, slot, offer, and restaurant fields", () => {
    const result = mapBookingToConfirmation(buildBooking());

    expect(result.id).toBe("booking_1");
    expect(result.code).toBe("AB23CD");
    expect(result.status).toBe("confirmed");
    expect(result.guestTelegramId).toBe("999");
    expect(result.slotDate).toBe("2026-10-06");
    expect(result.slotStartTime).toBe("12:00");
    expect(result.slotEndTime).toBe("14:00");
    expect(result.offerTitle).toBe("Lunch happy hour");
    expect(result.restaurantName).toBe("Demo Trattoria");
  });
});
