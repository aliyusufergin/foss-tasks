import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidPassword,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
} from "../src/domain/validation.js";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });
});

describe("isValidEmail", () => {
  it.each(["a@b.co", "alice@example.com", "x.y+z@sub.domain.io"])(
    "accepts %s",
    (email) => expect(isValidEmail(email)).toBe(true),
  );

  it.each(["", "no-at", "a@b", "a@@b.com", "a b@c.com", "@b.com"])(
    "rejects %s",
    (email) => expect(isValidEmail(email)).toBe(false),
  );
});

describe("isValidPassword", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it("accepts passwords at or above the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });
});
