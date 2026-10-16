import { describe, expect, it } from "vitest";
import { staleFriend } from "./format";

describe("stale friend notice", () => {
  it("uses two calendar months rather than a fixed 60-day window", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(staleFriend("2026-08-16T11:59:59Z", now)).toBe(true);
    expect(staleFriend("2026-08-16T12:00:01Z", now)).toBe(false);
    expect(staleFriend(null, now)).toBe(false);
    expect(staleFriend("invalid", now)).toBe(false);
  });
  it("clamps month ends as PostgreSQL does", () => {
    const now = Date.parse("2026-04-30T12:00:00Z");
    expect(staleFriend("2026-02-28T11:59:59Z", now)).toBe(true);
    expect(staleFriend("2026-02-28T12:00:01Z", now)).toBe(false);
  });
});
