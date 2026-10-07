import { describe, expect, it } from "vitest";
import { buildReminderMessage } from "./buildReminderMessage.js";

describe("buildReminderMessage", () => {
  it("includes time, place, offer, party size and the booking code", () => {
    const text = buildReminderMessage({
      restaurantName: "Demo Trattoria",
      offerTitle: "Тихий обед",
      startTime: "15:00",
      partySize: 2,
      discountPercent: 20,
      code: "K7MP2Q",
    });

    expect(text).toBe(
      [
        "Напоминаем о брони сегодня в 15:00",
        "Demo Trattoria · Тихий обед, скидка 20%",
        "Гостей: 2",
        "",
        "Код брони: K7MP2Q — покажите его при входе.",
      ].join("\n"),
    );
  });

  it("omits the discount when the slot has none", () => {
    const text = buildReminderMessage({
      restaurantName: "Burger Point",
      offerTitle: "Ужин",
      startTime: "20:00",
      partySize: 1,
      discountPercent: 0,
      code: "AAAAAA",
    });

    expect(text).toContain("Burger Point · Ужин\n");
    expect(text).not.toContain("скидка");
  });
});
