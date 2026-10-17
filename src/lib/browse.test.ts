import { describe, expect, it } from "vitest";
import { BROWSE_SORTS, browseQuery, parseBrowse, type SortablePlayer, sortPlayers, top3Score } from "./browse";

describe("trial suggestion controls", () => {
  it("defaults to Best for you and removes legacy sort/filter URL settings", () => {
    for (const params of [{}, { sort: "fit", spotlight: "safe" }, { sort: "unknown", page: "-3" }]) {
      expect(parseBrowse(params)).toEqual({ sort: "you_fit", everyone: false, page: 1 });
    }
    expect(BROWSE_SORTS.map(([id]) => id)).toEqual(["you_fit", "top3", "active"]);
    expect(browseQuery({ sort: "you_fit", everyone: false, page: 1 })).toBe("");
    expect(browseQuery({ sort: "active", everyone: true, page: 2 }, "Snack")).toBe("?q=Snack&sort=active&show=all&page=2");
  });
});

describe("estimated candy utility sorting", () => {
  const row = (user_id: string, you_fit_pct: number | null, you_utility: number | null): SortablePlayer => ({
    user_id, you_fit_pct, you_utility, last_seen_at: "2026-10-10T00:00:00Z",
  });
  const rows = [row("a", 90, 40), row("b", 65, 60), row("c", null, null), row("d", 0, -10)];
  it("sorts by unrounded utility, not Want percentage, and preserves negative values", () => {
    expect(sortPlayers(rows, "you_fit").map((r) => r.user_id)).toEqual(["b", "a", "d", "c"]);
    expect(sortPlayers([row("a", 10.01, 0.005), row("b", 10.02, 0.004)], "you_fit")[0].user_id).toBe("a");
  });
  it("uses only the viewer's fit to break ties, never a hidden other score", () => {
    const candidates = [{ ...rows[0], both_pct: 999 }, { ...rows[1], both_pct: -999 }];
    expect(sortPlayers(candidates, "you_fit")[0].user_id).toBe("b");
    expect(sortPlayers(candidates, "active")[0].user_id).toBe("b");
  });
  it("keeps Spotlight and activity sorts with the viewer's utility as fallback", () => {
    expect(sortPlayers(rows, "top3", { a: { x: "S" }, b: { x: "C" } }).map((r) => r.user_id)).toEqual(["a", "b", "d", "c"]);
    expect(top3Score({ x: "S", y: "B", z: "Avoid" })).toBe(6);
    expect(top3Score({})).toBeNull();
  });
});
