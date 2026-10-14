import { describe, expect, it } from "vitest";
import { friendRank, parseFriendSort, sortFriends } from "./friendSort";
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
  });
});
