import { describe, expect, it } from "vitest";
import { BROWSE_SORTS, browseQuery, matchesBrowseFilters, parseBrowse, type SortablePlayer, sortPlayers, spotlightAboveF, top3Score } from "./browse";

describe("trial suggestion controls", () => {
  it("defaults to Best for you and removes legacy sort/filter URL settings", () => {
    for (const params of [{}, { sort: "fit", spotlight: "safe" }, { sort: "unknown", page: "-3" }]) {
      expect(parseBrowse(params)).toEqual({ sort: "you_fit", everyone: true, activeWeek: false, votingFriends: false, spotlightSafe: false, newPlayers: false, hideDeclined: false, page: 1 });
    }
    expect(parseBrowse({ show: "mutual" }).everyone).toBe(false);
    expect(parseBrowse({ show: "good" }).everyone).toBe(false);
    expect(parseBrowse({ show: "all" }).everyone).toBe(true);
    expect(browseQuery({ sort: "you_fit", everyone: false, activeWeek: false, votingFriends: false, spotlightSafe: false, newPlayers: false, hideDeclined: false, page: 1 })).toBe("?show=mutual");
    expect(BROWSE_SORTS.map(([id]) => id)).toEqual(["you_fit", "top3", "active"]);
    expect(browseQuery({ sort: "you_fit", everyone: true, activeWeek: false, votingFriends: false, spotlightSafe: false, newPlayers: false, hideDeclined: false, page: 1 })).toBe("");
    expect(browseQuery({ sort: "active", everyone: true, activeWeek: false, votingFriends: false, spotlightSafe: false, newPlayers: false, hideDeclined: false, page: 2 }, "Snack")).toBe("?q=Snack&sort=active&page=2");
  });
});

describe("suggestion filters", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  const all = { everyone: true, activeWeek: false, votingFriends: false };
  const recent = { good: false, last_seen_at: "2026-10-16T12:00:00Z", list_voters: 2 };
  it("combines mutual fit, activity and voting friends without changing scores", () => {
    expect(matchesBrowseFilters(recent, all, now)).toBe(true);
    expect(matchesBrowseFilters(recent, { ...all, newPlayers: true }, now)).toBe(false);
    expect(matchesBrowseFilters({ ...recent, is_new: true }, { ...all, newPlayers: true }, now)).toBe(true);
    expect(matchesBrowseFilters({ ...recent, has_declined: true }, { ...all, hideDeclined: true }, now)).toBe(false);
    expect(matchesBrowseFilters({ ...recent, has_declined: false }, { ...all, hideDeclined: true }, now)).toBe(true);
    expect(matchesBrowseFilters(recent, { ...all, everyone: false }, now)).toBe(false);
    expect(matchesBrowseFilters(recent, { ...all, activeWeek: true, votingFriends: true }, now)).toBe(true);
    expect(matchesBrowseFilters({ ...recent, list_voters: 0 }, { ...all, votingFriends: true }, now)).toBe(false);
    expect(matchesBrowseFilters({ ...recent, last_seen_at: "2026-10-10T11:59:59Z" }, { ...all, activeWeek: true }, now)).toBe(false);
    expect(matchesBrowseFilters({ ...recent, last_seen_at: "2026-10-10T12:00:00Z" }, { ...all, activeWeek: true }, now)).toBe(true);
  });
  it("round-trips combined filters and preserves search and sort", () => {
    const opts = { sort: "active" as const, everyone: false, activeWeek: true, votingFriends: true, spotlightSafe: true, newPlayers: true, hideDeclined: true, page: 2 };
    const query = browseQuery(opts, "Snack");
    expect(query).toBe("?q=Snack&sort=active&show=mutual&active=week&friends=voting&spotlight=above-f&joined=new&declined=hide&page=2");
    expect(parseBrowse(Object.fromEntries(new URLSearchParams(query)))).toEqual(opts);
  });
});

describe("Spotlight above F", () => {
  it("checks every selected candy and excludes missing, F and unknown ranks", () => {
    expect(spotlightAboveF(["a", "b"], { a: "S", b: "C" })).toBe(true);
    for (const bad of ["Avoid", "F", "—", "unknown"]) expect(spotlightAboveF(["a", "b"], { a: "S", b: bad })).toBe(false);
    expect(spotlightAboveF(["a", "b"], { a: "S" })).toBe(false);
    expect(spotlightAboveF(["a"], undefined)).toBe(false);
    expect(spotlightAboveF([], { a: "S" })).toBe(false);
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
