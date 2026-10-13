/** Find New Friends list options, read from the URL (?sort=&show=&page=). */
export const BROWSE_SORTS = [
  ["fit", "Best fit"],
  ["active", "Recently active"],
  ["shared", "Most in common"],
] as const;

/** One line under the sort pills saying what the chosen order means. */
export const BROWSE_SORT_HINTS: Record<(typeof BROWSE_SORTS)[number][0], string> = {
  fit: "Highest fit % first: most of what they want is what your friends want, and they don't turn down your friends' favourites.",
  active: "Most recently online first, so they're likely to accept your friend request soon.",
  shared: "Most candies in common with your friends first, counted, whatever else they want. A big list can rank high with a lower fit %.",
};
export type BrowseSort = (typeof BROWSE_SORTS)[number][0];

export const BROWSE_PAGE_SIZE = 20;

export interface BrowseOptions {
  sort: BrowseSort;
  /** false: good fits only; true: everyone you could add. */
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
