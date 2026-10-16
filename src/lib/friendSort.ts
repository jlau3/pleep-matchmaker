import { BROWSE_SORT_HINTS, BROWSE_SORTS, playerSortScore } from "./browse";
import type { Top3Tiers } from "./top3Tiers";
import type { FriendRow } from "./types";

/** My Friends orders, read from ?sort= (best match when missing or unknown). Same names as Find New Friends. */
export const FRIEND_SORTS = BROWSE_SORTS;
export type FriendSort = (typeof FRIEND_SORTS)[number][0];

export const FRIEND_SORT_HINTS: Record<FriendSort, string> = {
  ...BROWSE_SORT_HINTS,
  active: "Most recently online first.",
};

export function parseFriendSort(value: string | null | undefined): FriendSort {
  return FRIEND_SORTS.some(([id]) => id === value) ? (value as FriendSort) : "fit";
}

/**
 * Sort key for a friend: higher first. Friends with no number yet rank -1,
 * private lists -2, so they always sit at the bottom.
 */
export function friendRank(f: FriendRow, sort: FriendSort, tiers?: Record<string, string>): number {
  if (!f.visible) return -2;
  const forThem = f.match_pct ?? null;
  const forYou = f.you_fit_pct ?? null;
  return playerSortScore({
    last_seen_at: f.last_seen_at,
    you_fit_pct: forYou,
    both_pct: forThem == null && forYou == null ? null : (forThem ?? 0) + (forYou ?? 0),
  }, sort, tiers) ?? -1;
}

/** Sorted copy; ties keep the order friends were added in. */
export function sortFriends(friends: FriendRow[], sort: FriendSort, top3: Top3Tiers = {}): FriendRow[] {
  return [...friends].sort((a, b) => friendRank(b, sort, top3[b.user_id]) - friendRank(a, sort, top3[a.user_id]));
}
