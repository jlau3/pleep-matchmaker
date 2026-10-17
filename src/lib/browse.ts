/** Find New Friends sorts; none uses the hidden other direction. */
export const BROWSE_SORTS = [
  ["you_fit", "Best for You"],
  ["top3", "Your Top 3 Spotlight"],
  ["active", "Recently Active"],
] as const;

/** One line under the sort pills saying what the chosen order means. */
export const BROWSE_SORT_HINTS: Record<(typeof BROWSE_SORTS)[number][0], string> = {
  you_fit: "Your estimated Want share minus half your unwanted share, highest first.",
  top3: "Players whose Percentile Tier Lists rank your spotlighted candies highest first, so they're more likely to send what you want. Set your Top 3 Spotlight in My Votes.",
  active: "Most recently online first, so they're likely to accept your friend request soon.",
};
export type BrowseSort = (typeof BROWSE_SORTS)[number][0];

export const BROWSE_PAGE_SIZE = 20;

export interface BrowseOptions {
  sort: BrowseSort;
  /** false: both exact utilities > 0; true: all eligible suggestions. */
  everyone: boolean;
  activeWeek: boolean;
  votingFriends: boolean;
  spotlightSafe: boolean;
  newPlayers: boolean;
  hideDeclined: boolean;
  /** 1-based. */
  page: number;
}

export function parseBrowse(params: { sort?: string; show?: string; page?: string; active?: string; friends?: string; spotlight?: string; joined?: string; declined?: string }): BrowseOptions {
  const sort = BROWSE_SORTS.some(([id]) => id === params.sort) ? (params.sort as BrowseSort) : "you_fit";
  const page = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Number.parseInt(params.page ?? "1", 10) || 1));
  return { sort, everyone: params.show !== "mutual" && params.show !== "good", activeWeek: params.active === "week", votingFriends: params.friends === "voting", spotlightSafe: params.spotlight === "above-f", newPlayers: params.joined === "new", hideDeclined: params.declined === "hide", page };
}

/** Query string for these options, dropping defaults; `q` (the search box) is kept. */
export function browseQuery(opts: BrowseOptions, q?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (opts.sort !== "you_fit") p.set("sort", opts.sort);
  if (!opts.everyone) p.set("show", "mutual");
  if (opts.activeWeek) p.set("active", "week");
  if (opts.votingFriends) p.set("friends", "voting");
  if (opts.spotlightSafe) p.set("spotlight", "above-f");
  if (opts.newPlayers) p.set("joined", "new");
  if (opts.hideDeclined) p.set("declined", "hide");
  if (opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Optional filters combine; they use only fields already disclosed on suggestion rows. */
export function matchesBrowseFilters(row: { good: boolean; last_seen_at: string; list_voters: number; is_new?: boolean; has_declined?: boolean },
  opts: Pick<BrowseOptions, "everyone" | "activeWeek" | "votingFriends"> & Partial<Pick<BrowseOptions, "newPlayers" | "hideDeclined">>, now = Date.now()): boolean {
  return (opts.everyone || row.good)
    && (!opts.activeWeek || Date.parse(row.last_seen_at) >= now - 7 * 86400_000)
    && (!opts.votingFriends || row.list_voters > 0)
    && (!opts.newPlayers || row.is_new === true)
    && (!opts.hideDeclined || row.has_declined !== true);
}

/** What sortPlayers needs from a Find New row (browse_all). */
export interface SortablePlayer {
  user_id: string;
  last_seen_at: string;
  you_fit_pct?: number | null;
  you_utility?: number | null;
  both_pct?: number | null;
  you_fit_wants?: string[];
}

const TIER_POINTS: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, Avoid: 0 };

/**
 * Your Top 3 Spotlight's score on one player's Tier List: S 4, A 3, B 2, C 1, Avoid 0
 * per starred line. Null when every one is a dash (they sort last).
 */
export function top3Score(tiers: Record<string, string> | null | undefined): number | null {
  const values = Object.values(tiers ?? {});
  return values.length === 0 ? null : values.reduce((sum, tier) => sum + (TIER_POINTS[tier] ?? 0), 0);
}

/** Require a known, non-F rank for every selected Spotlight candy. Missing ranks never pass. */
export function spotlightAboveF(tops: string[], tiers?: Record<string, string>): boolean {
  return tops.length > 0 && tops.every((id) => ["S", "A", "B", "C"].includes(tiers?.[id] ?? ""));
}

/** Shared primary score for both friend lists; each supplies its own row fields and tie order. */
export function playerSortScore(
  player: Pick<SortablePlayer, "last_seen_at" | "you_fit_pct" | "both_pct" | "you_utility">,
  sort: BrowseSort | "fit",
  tiers?: Record<string, string>,
): number | null {
  if (sort === "active") return Date.parse(player.last_seen_at);
  if (sort === "you_fit") return player.you_utility ?? null;
  if (sort === "top3") return top3Score(tiers);
  return player.both_pct ?? null;
}

/**
 * Find New's order, in the browser: the same keys as browse_players'
 * ORDER BY, so a sort looks the same either way. The chosen sort first
 * (missing values last), then your exact utility, activity and id. Hidden
 * other-player scores never affect this order.
 */
export function sortPlayers<T extends SortablePlayer>(
  rows: T[],
  sort: BrowseSort | "fit",
  top3: Record<string, Record<string, string>> = {},
): T[] {
  const desc = (a: number | null | undefined, b: number | null | undefined) =>
    a == null ? (b == null ? 0 : 1) : b == null ? -1 : b - a;
  return [...rows].sort(
    (a, b) =>
      desc(playerSortScore(a, sort, top3[a.user_id]), playerSortScore(b, sort, top3[b.user_id])) ||
      desc(a.you_utility, b.you_utility) ||
      Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at) ||
      (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0),
  );
}
