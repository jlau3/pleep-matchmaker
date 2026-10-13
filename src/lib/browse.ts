/** Find New Friends list options, read from the URL (?sort=&show=&page=). */
export const BROWSE_SORTS = [
  ["fit", "Best fit"],
  ["active", "Recently active"],
  ["shared", "Most in common"],
] as const;
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
