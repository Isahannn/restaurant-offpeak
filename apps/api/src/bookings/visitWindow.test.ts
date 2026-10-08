import { describe, expect, it } from "vitest";
import { visitWindow } from "./visitWindow.js";

// Slot: 2030-03-04 19:00 Moscow (= 16:00 UTC). End of that day in Moscow = 2030-03-04 21:00 UTC.
const slot = { date: new Date("2030-03-04T00:00:00Z"), startTime: "19:00" };
const at = (iso: string) => visitWindow(slot, new Date(iso), "Europe/Moscow");

describe("visitWindow", () => {
  it("keeps both marks closed well before the slot (e.g. two days early)", () => {
    expect(at("2030-03-02T16:00:00Z")).toEqual({ canMarkArrived: false, canMarkNoShow: false });
  });

  it("opens arrival 30 minutes before the start", () => {
    expect(at("2030-03-04T15:29:00Z").canMarkArrived).toBe(false);
    expect(at("2030-03-04T15:30:00Z").canMarkArrived).toBe(true);
  });

  it("allows a no-show only once the slot has started", () => {
    expect(at("2030-03-04T15:59:00Z").canMarkNoShow).toBe(false);
    expect(at("2030-03-04T16:00:00Z").canMarkNoShow).toBe(true);
  });

  it("closes arrival at the end of the slot's local day, but not no-show", () => {
    expect(at("2030-03-04T20:59:00Z").canMarkArrived).toBe(true);
    expect(at("2030-03-04T21:00:00Z")).toEqual({ canMarkArrived: false, canMarkNoShow: true });
  });
});
