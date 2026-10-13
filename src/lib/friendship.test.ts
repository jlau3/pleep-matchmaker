import { describe, expect, it } from "vitest";
import { DAYS_TO_FRIENDSHIP_LEVEL_5, friendshipLevel5Date } from "./friendship";

describe("friendshipLevel5Date", () => {
  it("is DAYS_TO_FRIENDSHIP_LEVEL_5 calendar days after the add date", () => {
    expect(DAYS_TO_FRIENDSHIP_LEVEL_5).toBe(100);
    const d = friendshipLevel5Date(new Date(2026, 9, 13, 23, 30)); // Oct 13, late evening
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 21]); // Jan 21, 2027
  });
});
