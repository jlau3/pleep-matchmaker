import type { FriendRow } from "./types";

/** My Friends orders, read from ?sort= (best fit when missing or unknown). */
export const FRIEND_SORTS = [
  ["fit", "Best fit"],
  ["for_you", "Best for you"],
  ["for_them", "Best for them"],
  ["active", "Recently active"],
] as const;
export type FriendSort = (typeof FRIEND_SORTS)[number][0];

export const FRIEND_SORT_HINTS: Record<FriendSort, string> = {
  fit: "Average of both fits, best first.",
  for_you: "Whose friends want what you want, best first. Low ones mostly send you candy you don't need.",
  for_them: "Whose wants match your friends', best first. Low ones mostly get candy they don't need from you.",
  active: "Most recently online first.",
};

export function parseFriendSort(value: string | undefined): FriendSort {
  return FRIEND_SORTS.some(([id]) => id === value) ? (value as FriendSort) : "fit";
}

/**
 * Sort key for a friend: higher first. Friends with no number yet rank -1,
 * private lists -2, so they always sit at the bottom.
 */
export function friendRank(f: FriendRow, sort: FriendSort): number {
  if (!f.visible) return -2;
  if (sort === "active") return new Date(f.last_seen_at).getTime();
  const forThem = f.match_pct ?? null;
  const forYou = f.you_fit_pct ?? null;
  if (sort === "for_you") return forYou ?? -1;
  if (sort === "for_them") return forThem ?? -1;
  // Best fit: the average, or either one alone when the other is unknown.
  if (forThem == null && forYou == null) return -1;
  return ((forThem ?? forYou)! + (forYou ?? forThem)!) / 2;
}

/** Sorted copy; ties keep the order friends were added in. */
export function sortFriends(friends: FriendRow[], sort: FriendSort): FriendRow[] {
  return [...friends].sort((a, b) => friendRank(b, sort) - friendRank(a, sort));
}
