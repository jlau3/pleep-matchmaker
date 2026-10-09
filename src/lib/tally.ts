import { type CandyLine, LINES_BY_ID } from "./lines";

/**
 * Counts how many lists include each line. Returns lines ordered by count
 * (highest first, then dex), plus the counts for badges.
 */
export function tally(lists: string[][]): { lines: CandyLine[]; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const list of lists) {
    for (const id of new Set(list)) {
      if (LINES_BY_ID.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const lines = [...counts.keys()]
    .map((id) => LINES_BY_ID.get(id)!)
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || a.dex - b.dex);
  return { lines, counts };
}
