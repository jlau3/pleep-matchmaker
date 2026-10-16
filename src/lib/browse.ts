/** Sort choices shared by My Friends and Find New Friends. */
export const BROWSE_SORTS = [
  ["fit", "Best match"],
  ["you_fit", "Best for you"],
  ["top3", "Your Top 3"],
  ["active", "Recently active"],
] as const;

/** One line under the sort pills saying what the chosen order means. */
export const BROWSE_SORT_HINTS: Record<(typeof BROWSE_SORTS)[number][0], string> = {
  fit: "Highest total of both match %s first (a – counts as 0): you'd each send candy the other wants, so they're likely to add you back.",
  you_fit: "Highest \"for you\" first: most of what you want is what their friends want.",
  top3: "Players whose Tier List ranks your Top 3 highest first, so they're likeliest to send your favorite candy. Star your Top 3 in My Votes.",
  active: "Most recently online first, so they're likely to accept your friend request soon.",
};
export type BrowseSort = (typeof BROWSE_SORTS)[number][0];

export const BROWSE_PAGE_SIZE = 20;

export interface BrowseOptions {
  sort: BrowseSort;
  /** false: good matches only; true: everyone you could add. */
  everyone: boolean;
  /** 1-based. */
  page: number;
}

export function parseBrowse(params: { sort?: string; show?: string; page?: string }): BrowseOptions {
  const sort = BROWSE_SORTS.some(([id]) => id === params.sort) ? (params.sort as BrowseSort) : "fit";
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.page ?? "1", 10) || 1));
  return { sort, everyone: params.show === "all", page };
}

/** Query string for these options, dropping defaults; `q` (the search box) is kept. */
export function browseQuery(opts: BrowseOptions, q?: string): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (opts.sort !== "fit") p.set("sort", opts.sort);
  if (opts.everyone) p.set("show", "all");
  if (opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** What sortPlayers needs from a Find New row (browse_all). */
export interface SortablePlayer {
  user_id: string;
  last_seen_at: string;
  you_fit_pct?: number | null;
  both_pct?: number | null;
  you_fit_wants?: string[];
}

const TIER_POINTS: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, Avoid: 0 };

/**
 * Your Top 3's score on one player's Tier List: S 4, A 3, B 2, C 1, Avoid 0
 * per starred line. Null when every one is a dash (they sort last).
 */
export function top3Score(tiers: Record<string, string> | null | undefined): number | null {
  const values = Object.values(tiers ?? {});
  return values.length === 0 ? null : values.reduce((sum, tier) => sum + (TIER_POINTS[tier] ?? 0), 0);
}

/** Shared primary score for both friend lists; each supplies its own row fields and tie order. */
export function playerSortScore(
  player: Pick<SortablePlayer, "last_seen_at" | "you_fit_pct" | "both_pct">,
  sort: BrowseSort,
  tiers?: Record<string, string>,
): number | null {
  if (sort === "active") return Date.parse(player.last_seen_at);
  if (sort === "you_fit") return player.you_fit_pct ?? null;
  if (sort === "top3") return top3Score(tiers);
  return player.both_pct ?? null;
}

/**
 * Find New's order, in the browser: the same keys as browse_players'
 * ORDER BY, so a sort looks the same either way. The chosen sort first
 * (missing values last), then Best match (both_pct), more of your wants on
 * their list, more recently seen, and the id to break ties.
 */
export function sortPlayers<T extends SortablePlayer>(
  rows: T[],
  sort: BrowseSort,
  top3: Record<string, Record<string, string>> = {},
): T[] {
  const desc = (a: number | null | undefined, b: number | null | undefined) =>
    a == null ? (b == null ? 0 : 1) : b == null ? -1 : b - a;
  return [...rows].sort(
    (a, b) =>
      desc(playerSortScore(a, sort, top3[a.user_id]), playerSortScore(b, sort, top3[b.user_id])) ||
      desc(a.both_pct, b.both_pct) ||
      (b.you_fit_wants?.length ?? 0) - (a.you_fit_wants?.length ?? 0) ||
      Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at) ||
      (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0),
  );
}
