import { describe, expect, it } from "vitest";
import { computeSlotsForOffer } from "./slotGeneration.js";

describe("computeSlotsForOffer", () => {
  it("splits the offer window into one-hour slots for each matching day", () => {
    // 2026-10-05 is a Monday (dayOfWeek=1); offer runs Mon/Wed/Fri, 18:00-20:00.
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [1, 3, 5],
        startTime: "18:00",
        endTime: "20:00",
        seatsPerSlot: 4,
        discountPercent: 0,
        discountWindows: [],
      },
      { fromDate: "2026-10-05", days: 7 },
    );

    expect(slots).toHaveLength(6); // 3 matching days x 2 one-hour blocks
  });

  it("returns an empty array when daysOfWeek is empty", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [],
        startTime: "18:00",
        endTime: "20:00",
        seatsPerSlot: 4,
        discountPercent: 0,
        discountWindows: [],
      },
      { fromDate: "2026-10-05", days: 7 },
    );

    expect(slots).toEqual([]);
  });

  it("returns an empty array when days is 0", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "18:00",
        endTime: "20:00",
        seatsPerSlot: 4,
        discountPercent: 0,
        discountWindows: [],
      },
      { fromDate: "2026-10-05", days: 0 },
    );

    expect(slots).toEqual([]);
  });

  it("drops a trailing partial hour that doesn't make a full block", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [1],
        startTime: "12:00",
        endTime: "13:30",
        seatsPerSlot: 2,
        discountPercent: 0,
        discountWindows: [],
      },
      { fromDate: "2026-10-05", days: 1 },
    );

    expect(slots).toEqual([
      {
        date: "2026-10-05",
        startTime: "12:00",
        endTime: "13:00",
        seatsTotal: 2,
        discountPercent: 0,
      },
    ]);
  });

  it("correctly wraps across a month boundary", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "09:00",
        endTime: "10:00",
        seatsPerSlot: 1,
        discountPercent: 0,
        discountWindows: [],
      },
      { fromDate: "2026-10-30", days: 4 },
    );

    expect(slots.map((s) => s.date)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("applies the discount to every hour when no discount windows are given", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [1],
        startTime: "11:00",
        endTime: "13:00",
        seatsPerSlot: 4,
        discountPercent: 20,
        discountWindows: [],
      },
      { fromDate: "2026-10-05", days: 1 },
    );

    expect(slots.map((s) => s.discountPercent)).toEqual([20, 20]);
  });

  it("applies the discount only within an explicit discount window", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [1],
        startTime: "11:00",
        endTime: "15:00",
        seatsPerSlot: 4,
        discountPercent: 30,
        discountWindows: [{ startTime: "11:00", endTime: "13:00" }],
      },
      { fromDate: "2026-10-05", days: 1 },
    );

    expect(
      slots.map((s) => `${s.startTime}-${s.endTime}:${s.discountPercent}`),
    ).toEqual(["11:00-12:00:30", "12:00-13:00:30", "13:00-14:00:0", "14:00-15:00:0"]);
  });

  it("supports multiple, non-contiguous discount windows", () => {
    const slots = computeSlotsForOffer(
      {
        daysOfWeek: [1],
        startTime: "10:00",
        endTime: "22:00",
        seatsPerSlot: 4,
        discountPercent: 15,
        discountWindows: [
          { startTime: "10:00", endTime: "11:00" },
          { startTime: "20:00", endTime: "22:00" },
        ],
      },
      { fromDate: "2026-10-05", days: 1 },
    );

    const discounted = slots.filter((s) => s.discountPercent > 0).map((s) => s.startTime);
    expect(discounted).toEqual(["10:00", "20:00", "21:00"]);
    expect(slots).toHaveLength(12);
  });
});
