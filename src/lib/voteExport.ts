import { type CandyLine, type Choice, LINES, lineSpriteUrl } from "./lines";
import type { ImageRow } from "@/components/TierExport";

/** Badge colors: the Tier List's gold for Top 3 Spotlight, then the vote colors used across the site. */
const ROWS: { choice: Choice | "top"; label: string; color: ImageRow["color"] }[] = [
  { choice: "top", label: "Top 3\nSpotlight", color: { bg: "#ffd24d", fg: "#5b3e00" } },
  { choice: "want", label: "Want", color: { bg: "#3fb86b", fg: "#ffffff" } },
  { choice: "undecided", label: "Neutral", color: { bg: "#8a97ab", fg: "#ffffff" } },
  { choice: "dont_want", label: "Don't\nWant", color: { bg: "#ec6b6b", fg: "#ffffff" } },
];

/** Spotlight is global; all other rows and counts use the exact active filter matches. */
export function voteExport(choices: Record<string, Choice>, tops: Set<string>, lines: CandyLine[]) {
  const rows: ImageRow[] = ROWS.map(({ choice, label, color }) => ({
    label,
    color,
    items: (choice === "top" ? LINES.filter((line) => tops.has(line.id)) : lines.filter((line) => (choices[line.id] ?? "undecided") === choice))
      .map((line) => ({ sprite: lineSpriteUrl(line) })),
  }));
  const counts = { want: 0, undecided: 0, dont_want: 0 };
  for (const line of lines) counts[choices[line.id] ?? "undecided"]++;
  return { rows, counts };
}
