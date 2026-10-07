import { describe, expect, it } from "vitest";
import { generateBookingCode } from "./generateBookingCode.js";

describe("generateBookingCode", () => {
  it("returns a 6-character code using only unambiguous uppercase letters and digits", () => {
    const code = generateBookingCode();

    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("excludes visually ambiguous characters (0, O, 1, I)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBookingCode();
      expect(code).not.toMatch(/[0O1I]/);
    }
  });
});
