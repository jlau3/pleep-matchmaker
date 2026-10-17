import { BROWSE_SORT_HINTS, BROWSE_SORTS, playerSortScore } from "./browse";
import type { Top3Tiers } from "./top3Tiers";
import type { FriendRow } from "./types";

/** My Friends orders, read from ?sort= (best match when missing or unknown). Same names as Find New Friends. */
export const FRIEND_SORTS = [["fit", "Best Match"], ...BROWSE_SORTS] as const;
export type FriendSort = (typeof FRIEND_SORTS)[number][0];

export const FRIEND_SORT_HINTS: Record<FriendSort, string> = {
  ...BROWSE_SORT_HINTS,
  fit: "Highest combined utility first: Want share minus half unwanted share in both directions.",
  active: "Most recently online first.",
};

export function parseFriendSort(value: string | null | undefined): FriendSort {
  return FRIEND_SORTS.some(([id]) => id === value) ? (value as FriendSort) : "fit";
}

/**
 * Sort key for a friend: higher first. Missing data sorts below all known utilities,
 * including negative ones; private lists sort last, so they always sit at the bottom.
 */
export function friendRank(f: FriendRow, sort: FriendSort, tiers?: Record<string, string>): number {
  if (!f.visible) return -Infinity;
  const forThem = f.they_utility ?? null;
  const forYou = f.you_utility ?? null;
  return playerSortScore({
    last_seen_at: f.last_seen_at,
    you_utility: forYou,
    both_pct: forThem == null && forYou == null ? null : (forThem ?? 0) + (forYou ?? 0),
  }, sort, tiers) ?? -Number.MAX_VALUE;
}

/** Sorted copy; ties keep the order friends were added in. */
export function sortFriends(friends: FriendRow[], sort: FriendSort, top3: Top3Tiers = {}): FriendRow[] {
  return [...friends].sort((a, b) => friendRank(b, sort, top3[b.user_id]) - friendRank(a, sort, top3[a.user_id]));
}
