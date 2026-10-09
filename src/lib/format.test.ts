import { describe, expect, it } from "vitest";
import { formatFriendCode, normalizeFriendCode, relativeTime } from "./format";

describe("friend codes", () => {
  it("accepts any separators", () => {
    expect(normalizeFriendCode("1234 5678 9012")).toBe("123456789012");
    expect(normalizeFriendCode("1234-5678-9012")).toBe("123456789012");
  });
  it("rejects the wrong length", () => {
    expect(normalizeFriendCode("1234 5678 901")).toBeNull();
    expect(normalizeFriendCode("")).toBeNull();
  });
  it("formats in groups of four", () => {
    expect(formatFriendCode("123456789012")).toBe("1234 5678 9012");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");
  it.each([
    ["2026-10-09T11:59:30Z", "just now"],
    ["2026-10-09T11:55:00Z", "5m ago"],
    ["2026-10-09T09:00:00Z", "3h ago"],
    ["2026-10-06T12:00:00Z", "3d ago"],
    ["2026-09-18T12:00:00Z", "3w ago"],
    ["2026-06-01T12:00:00Z", "4mo ago"],
    ["2024-10-01T12:00:00Z", "2y ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
  it("handles null", () => {
    expect(relativeTime(null)).toBe("never");
  });
});
