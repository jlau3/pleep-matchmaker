import { describe, expect, it } from "vitest";
import { relationOf, sortRequests } from "./relations";

const now = Date.parse("2026-10-19T00:00:00Z");
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

describe("sortRequests", () => {
  it("splits your requests from requests to you, keeping your lapsed ones as expired", () => {
    const rows = [
      { from_id: "me", to_id: "a", status: "open" as const, created_at: daysAgo(1) },
      { from_id: "me", to_id: "b", status: "declined" as const, created_at: daysAgo(40) },
      { from_id: "me", to_id: "c", status: "open" as const, created_at: daysAgo(31) },
      { from_id: "d", to_id: "me", status: "open" as const, created_at: daysAgo(2) },
      { from_id: "e", to_id: "me", status: "declined" as const, created_at: daysAgo(2) },
    ];
    expect(sortRequests(rows, "me", now)).toEqual({ sent: { a: "open", b: "declined", c: "expired" }, incoming: ["d"] });
  });
});

describe("relationOf", () => {
  const relations = { friendIds: ["f"], sent: { s: "open" as const, x: "declined" as const, o: "expired" as const, i: "expired" as const }, incoming: ["i"] };
  it("names each state", () => {
    expect(relationOf(relations, "f")).toBe("friend");
    expect(relationOf(relations, "s")).toBe("sent");
    expect(relationOf(relations, "x")).toBe("declined");
    expect(relationOf(relations, "o")).toBe("expired");
    expect(relationOf(relations, "i")).toBe("incoming");
    expect(relationOf(relations, "n")).toBe("none");
  });
});
