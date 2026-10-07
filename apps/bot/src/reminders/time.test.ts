import { describe, expect, it } from "vitest";
import { localDateString, slotStartInstant } from "@app/shared";

describe("slotStartInstant", () => {
  it("interprets the slot's wall-clock time in the given time zone", () => {
    const start = slotStartInstant(new Date("2026-10-05T00:00:00Z"), "15:00", "Europe/Moscow");
    expect(start.toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });

  it("handles UTC", () => {
    const start = slotStartInstant(new Date("2026-10-05T00:00:00Z"), "09:30", "UTC");
    expect(start.toISOString()).toBe("2026-10-05T09:30:00.000Z");
  });

  it("accounts for daylight saving time", () => {
    const winter = slotStartInstant(new Date("2026-01-15T00:00:00Z"), "12:00", "Europe/Berlin");
    const summer = slotStartInstant(new Date("2026-07-15T00:00:00Z"), "12:00", "Europe/Berlin");
    expect(winter.toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(summer.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("crosses the date boundary for zones ahead of UTC", () => {
    const start = slotStartInstant(new Date("2026-10-05T00:00:00Z"), "01:00", "Asia/Tokyo");
    expect(start.toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
});

describe("localDateString", () => {
  it("returns the calendar day in the given zone, not in UTC", () => {
    // 22:30 UTC on Oct 5 is already 01:30 on Oct 6 in Moscow.
    const instant = new Date("2026-10-05T22:30:00Z");
    expect(localDateString(instant, "Europe/Moscow")).toBe("2026-10-06");
    expect(localDateString(instant, "UTC")).toBe("2026-10-05");
  });
});
