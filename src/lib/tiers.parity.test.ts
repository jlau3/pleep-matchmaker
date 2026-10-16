import { describe, expect, it } from "vitest";
import type { CandyLine } from "./lines";
import { buildTiers } from "./tiers";

/**
 * The database grades your Top 3 on other players' Tier Lists with its own copy
 * of these rules (public.list_tiers, latest in 20261026000200_pyramid_tiers.sql). Its test,
 * supabase/tests/top3_tiers_test.sql, expects exactly these tiers for the same
 * votes: change the rules here and that copy (and test) must change too.
 */
describe("Tier List rules shared with the database", () => {
  const votes: Record<string, [number, number]> = {
    q1: [4, 0], q2: [3, 0], q3: [2, 1], q4: [1, 0], q5: [0, 2], q6: [2, 0], q7: [1, 1], q8: [0, 1],
  };
  const tiersFor = (lineCount: number) => {
    const lines = Array.from({ length: lineCount }, (_, i) => ({ id: i < 8 ? `q${i + 1}` : `u${i - 7}`, name: "x", dex: i + 1, rare: false }));
    const counts = new Map(Object.entries(votes).map(([id, [w, d]]) => [id, { wants: w, dontWants: d, tops: 0 }]));
    const out: Record<string, string> = {};
    for (const [tier, rows] of buildTiers(counts, 4, lines as unknown as CandyLine[]))
      if (tier !== "top") for (const r of rows) out[r.line.id.startsWith("u") ? "" : r.line.id] = tier === "avoid" ? "Avoid" : tier;
    return out;
  };
  it("matches list_tiers for 20, 10 and 8 lines", () => {
    for (const count of [20, 10]) expect(tiersFor(count)).toEqual({ q1: "S", q2: "A", q6: "B", q3: "B", q4: "C", "": "C", q7: "C", q8: "Avoid", q5: "Avoid" });
    expect(tiersFor(8)).toEqual({ q1: "S", q2: "A", q6: "B", q3: "B", q4: "C", q7: "C", q8: "Avoid", q5: "Avoid" });
  });
});
