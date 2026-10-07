import { describe, expect, it } from "vitest";
import { buildNewBookingMessage, dayLabel } from "./buildNewBookingMessage.js";

describe("dayLabel", () => {
  // 2026-10-08 21:30 UTC is already 00:30 on Oct 9 in Moscow.
  const now = new Date("2026-10-08T21:30:00Z");

  it("names today and tomorrow in the restaurant's zone", () => {
    expect(dayLabel("2026-10-09", now, "Europe/Moscow")).toBe("сегодня");
    expect(dayLabel("2026-10-10", now, "Europe/Moscow")).toBe("завтра");
  });

  it("falls back to a short date", () => {
    expect(dayLabel("2026-10-14", now, "Europe/Moscow")).toBe("14 окт.");
  });
});

describe("buildNewBookingMessage", () => {
  it("summarises the booking for staff", () => {
    expect(
      buildNewBookingMessage({
        day: "сегодня",
        startTime: "15:00",
        offerTitle: "Тихий обед",
        discountPercent: 20,
        partySize: 2,
        code: "K7MP2Q",
      }),
    ).toBe(["Новая бронь · сегодня, 15:00", "Тихий обед, скидка 20%", "Гостей: 2 · код K7MP2Q"].join("\n"));
  });

  it("omits a zero discount", () => {
    const text = buildNewBookingMessage({
      day: "завтра",
      startTime: "20:00",
      offerTitle: "Ужин",
      discountPercent: 0,
      partySize: 1,
      code: "AAAAAA",
    });
    expect(text).not.toContain("скидка");
  });
});
