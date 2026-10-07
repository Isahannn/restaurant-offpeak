import { describe, expect, it } from "vitest";
import { isAdmin } from "./isAdmin.js";

describe("isAdmin", () => {
  it("returns true when the user id is in the comma-separated admin list", () => {
    expect(isAdmin(123, "123,456")).toBe(true);
    expect(isAdmin(456, "123,456")).toBe(true);
  });

  it("returns false when the user id is not in the admin list", () => {
    expect(isAdmin(789, "123,456")).toBe(false);
  });

  it("tolerates whitespace around ids", () => {
    expect(isAdmin(456, " 123 , 456 ")).toBe(true);
  });

  it("returns false for every user when the admin list is unset", () => {
    expect(isAdmin(123, undefined)).toBe(false);
    expect(isAdmin(123, "")).toBe(false);
  });
});
