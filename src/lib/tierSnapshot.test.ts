import { describe, expect, it } from "vitest";
import data from "@/data/dev-tier-snapshot.json";
import { isDevTierSnapshotEnabled, parseTierSnapshot, TIER_SNAPSHOT_DEV_BRANCH } from "./tierSnapshot";

const preview = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: TIER_SNAPSHOT_DEV_BRANCH, NODE_ENV: "production" };
describe("aggregate snapshot scope", () => {
  it("enables the test snapshot only in this branch's preview or local development", () => {
    expect(isDevTierSnapshotEnabled(preview)).toBe(true);
    expect(isDevTierSnapshotEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isDevTierSnapshotEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDevTierSnapshotEnabled({})).toBe(false);
    expect(isDevTierSnapshotEnabled({ ...preview, VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
    expect(isDevTierSnapshotEnabled({ ...preview, VERCEL_ENV: "production" })).toBe(false);
  });
  it("copies all supplied counts without generating players or approximating votes", () => {
    const snapshot = parseTierSnapshot(data);
    expect(snapshot.voters).toBe(201);
    expect(snapshot.candies).toBe(107);
    for (const row of data.lines) expect(snapshot.votes[row.line_id]).toEqual({ wants: row.wants, dontWants: row.dont_wants, tops: row.tops, seen: row.seen });
  });
  it("masks small groups before values can be serialized to the page", () => {
    const small = { ...data, lines: [{ line_id: "pikachu", seen: 9, wants: 7, dont_wants: 1, tops: 2 }] };
    expect(parseTierSnapshot(small).votes).toEqual({});
  });
  it.each([
    { seen: 201, wants: 202, dont_wants: 0, tops: 0 },
    { seen: 201, wants: 2, dont_wants: 1, tops: 3 },
    { seen: -1, wants: 0, dont_wants: 0, tops: 0 },
  ])("rejects inconsistent counts", (row) => {
    expect(() => parseTierSnapshot({ ...data, lines: [{ line_id: "pikachu", ...row }] })).toThrow();
  });
});
