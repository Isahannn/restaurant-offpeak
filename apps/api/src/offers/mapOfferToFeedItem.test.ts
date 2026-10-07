import { describe, expect, it } from "vitest";
import { mapOfferToFeedItem, type OfferWithRelations } from "./mapOfferToFeedItem.js";

function buildOffer(overrides: Partial<OfferWithRelations> = {}): OfferWithRelations {
  return {
    id: "offer_1",
    restaurantId: "rest_1",
    restaurant: { name: "Demo Trattoria", imageUrl: "https://images.unsplash.com/photo-1.jpg" },
    title: "Lunch happy hour",
    discountPercent: 25,
    exceptions: ["drinks"],
    daysOfWeek: [1, 3, 5],
    startTime: "12:00",
    endTime: "14:00",
    seatsPerSlot: 8,
    active: true,
    slots: [
      {
        id: "slot_1",
        offerId: "offer_1",
        date: new Date("2026-10-05T00:00:00.000Z"),
        startTime: "12:00",
        endTime: "14:00",
        seatsTotal: 8,
        seatsBooked: 2,
        discountPercent: 25,
      },
    ],
    ...overrides,
  };
}

describe("mapOfferToFeedItem", () => {
  it("flattens the restaurant name and maps scalar offer fields", () => {
    const result = mapOfferToFeedItem(buildOffer());

    expect(result.restaurantName).toBe("Demo Trattoria");
    expect(result.restaurantImageUrl).toBe("https://images.unsplash.com/photo-1.jpg");
    expect(result.id).toBe("offer_1");
    expect(result.discountPercent).toBe(25);
    expect(result.exceptions).toEqual(["drinks"]);
  });

  it("formats slot dates as YYYY-MM-DD strings", () => {
    const result = mapOfferToFeedItem(buildOffer());

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].date).toBe("2026-10-05");
    expect(result.slots[0].seatsTotal).toBe(8);
    expect(result.slots[0].seatsBooked).toBe(2);
    expect(result.slots[0].discountPercent).toBe(25);
  });

  it("preserves an empty slots list", () => {
    const result = mapOfferToFeedItem(buildOffer({ slots: [] }));

    expect(result.slots).toEqual([]);
  });
});
