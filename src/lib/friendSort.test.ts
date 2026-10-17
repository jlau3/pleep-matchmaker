import { describe, expect, it } from "vitest";
import { FRIEND_SORTS, friendRank, parseFriendSort, sortFriends } from "./friendSort";
import { sortPlayers } from "./browse";
import type { FriendRow } from "./types";

const friend = (id: string, they: number | null, you: number | null, extra: Partial<FriendRow> = {}): FriendRow => ({
  user_id: id,
  discord_username: null,
  discord_display_name: null,
  avatar_url: null,
  ign: id,
  friend_code: null,
  last_seen_at: "2026-10-01T00:00:00Z",
  prefs_updated_at: null,
  added_at: "2026-10-01T00:00:00Z",
  visible: true,
  wants: [],
  dont_wants: [],
  top_wants: [],
  match_pct: they,
  you_fit_pct: you,
  you_utility: you,
  they_utility: they,
  added_me: false,
  ...extra,
});

describe("friend sorts", () => {
  const a = friend("a", 90, 10);
  const b = friend("b", 40, 70);
  const c = friend("c", null, null);
  const d = friend("d", 99, 99, { visible: false });

  it("best match adds both, unknowns then private last", () => {
    expect(sortFriends([c, d, a, b], "fit").map((f) => f.user_id)).toEqual(["b", "a", "c", "d"]);
  });

  it("sorts by best for you", () => {
    expect(sortFriends([a, b], "you_fit").map((f) => f.user_id)).toEqual(["b", "a"]);
  });

  it("counts a missing number as 0 for best match", () => {
    expect(friendRank(friend("x", null, 60), "fit")).toBe(60);
    // 90 "for them" with no "for you" ranks below 50 / 50.
    expect(friendRank(friend("y", 90, null), "fit")).toBeLessThan(friendRank(friend("z", 50, 50), "fit"));
  });

  it("falls back to best match for unknown sorts", () => {
    expect(parseFriendSort("nope")).toBe("fit");
    expect(parseFriendSort("you_fit")).toBe("you_fit");
    expect(parseFriendSort("for_them")).toBe("fit");
    expect(parseFriendSort("top3")).toBe("top3");
  });

  it("sorts by your Top 3 tiers, with Avoid above missing data and private friends last", () => {
    const unknown = friend("unknown", 100, 100);
    const tiers = { a: { x: "S", y: "A" }, b: { x: "B" }, c: { x: "Avoid" }, d: { x: "S", y: "S", z: "S" } };
    expect(sortFriends([unknown, d, b, c, a], "top3", tiers).map((f) => f.user_id)).toEqual(["a", "b", "c", "unknown", "d"]);
  });

  it("keeps existing friend order when no Top 3 tiers are available", () => {
    expect(sortFriends([d, b, c, a], "top3").map((f) => f.user_id)).toEqual(["b", "c", "a", "d"]);
  });

  it.each(FRIEND_SORTS)("agrees with Find New on the primary %s ordering", (sort) => {
    const friends = [
      { ...a, last_seen_at: "2026-10-01T00:00:00Z" },
      { ...b, last_seen_at: "2026-10-02T00:00:00Z" },
      { ...c, last_seen_at: "2026-10-03T00:00:00Z" },
    ];
    const tiers = { a: { x: "S", y: "A" }, b: { x: "C" } };
    const candidates = friends.map((f) => ({
      ...f,
      both_pct: f.match_pct === null && f.you_fit_pct === null ? null : (f.match_pct ?? 0) + (f.you_fit_pct ?? 0),
    }));
    expect(sortFriends(friends, sort, tiers).map((f) => f.user_id)).toEqual(sortPlayers(candidates, sort, tiers).map((f) => f.user_id));
  });
});

it("keeps real negative utility above missing data and private friends", () => {
  const rows = [friend("unknown", null, null), friend("private", 0, 0, { visible: false }), friend("negative", -40, -30)];
  expect(sortFriends(rows, "you_fit").map((r) => r.user_id)).toEqual(["negative", "unknown", "private"]);
});
