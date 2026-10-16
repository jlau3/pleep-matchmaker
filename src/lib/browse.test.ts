import { describe, expect, it } from "vitest";
import { browseQuery, parseBrowse, type SortablePlayer, sortPlayers, top3Score } from "./browse";

describe("Find New Friends options", () => {
  it("defaults and validates", () => {
    expect(parseBrowse({})).toEqual({ sort: "fit", everyone: false, page: 1 });
    expect(parseBrowse({ sort: "nope", show: "x", page: "-3" })).toEqual({ sort: "fit", everyone: false, page: 1 });
    expect(parseBrowse({ sort: "active", show: "all", page: "4" })).toEqual({ sort: "active", everyone: true, page: 4 });
  });

  it("builds query strings without defaults, keeping the search", () => {
    expect(browseQuery({ sort: "fit", everyone: false, page: 1 })).toBe("");
    expect(browseQuery({ sort: "active", everyone: true, page: 2 }, "bob")).toBe("?q=bob&sort=active&show=all&page=2");
  });
});

describe("sortPlayers", () => {
  const row = (user_id: string, o: Partial<SortablePlayer> = {}): SortablePlayer => ({
    user_id,
    last_seen_at: "2026-10-10T00:00:00Z",
    you_fit_pct: null,
    both_pct: null,
    you_fit_wants: [],
    ...o,
  });
  const rows = [
    row("a", { both_pct: 120, you_fit_pct: 40, last_seen_at: "2026-10-01T00:00:00Z" }),
    row("b", { both_pct: 150, you_fit_pct: 90 }),
    row("c", { both_pct: null, you_fit_pct: null, last_seen_at: "2026-10-14T00:00:00Z" }),
    row("d", { both_pct: 120, you_fit_pct: 70, you_fit_wants: ["x", "y"] }),
  ];
  const ids = (sorted: SortablePlayer[]) => sorted.map((r) => r.user_id).join("");

  it("Best match: both_pct, then more of your wants, then recent; no numbers last", () => {
    expect(ids(sortPlayers(rows, "fit"))).toBe("bdac");
  });

  it("other sorts lead with their own key, missing values last", () => {
    expect(ids(sortPlayers(rows, "you_fit"))).toBe("bdac");
    expect(ids(sortPlayers(rows, "active"))).toBe("cbda");
    // Top 3: a scores S+A (7), d C (1), b and c all dashes (fall back to Best match).
    expect(ids(sortPlayers(rows, "top3", { a: { l1: "S", l2: "A" }, d: { l1: "C" }, b: {} }))).toBe("adbc");
  });

  it("scores Top 3 tiers", () => {
    expect(top3Score({ x: "S", y: "B", z: "Avoid" })).toBe(6);
    expect(top3Score({})).toBeNull();
    expect(top3Score(undefined)).toBeNull();
  });
});

describe("Spotlight specialty filter", () => {
  it("round-trips through shared URLs without losing the pool, sort or search", () => {
    const opts = parseBrowse({ sort: "top3", show: "all", spotlight: "safe", page: "2" });
    expect(opts.spotlight).toBe(true);
    expect(browseQuery(opts, "Snack")).toBe("?q=Snack&sort=top3&show=all&spotlight=safe&page=2");
    expect(parseBrowse({ spotlight: "other" }).spotlight).toBeUndefined();
  });
});
