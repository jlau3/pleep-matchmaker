"use client";

import { type Choice, LINES, lineSpriteUrl } from "@/lib/lines";
import { type ImageRow, ImageExport, today } from "./TierExport";

/** Badge colors: the Tier List's gold for Top 3, then the vote colors used across the site. */
const ROWS: { choice: Choice | "top"; label: string; color: ImageRow["color"] }[] = [
  { choice: "top", label: "Top 3", color: { bg: "#ffd24d", fg: "#5b3e00" } },
  { choice: "want", label: "Want", color: { bg: "#3fb86b", fg: "#ffffff" } },
  { choice: "undecided", label: "Neutral", color: { bg: "#8a97ab", fg: "#ffffff" } },
  { choice: "dont_want", label: "Don't\nWant", color: { bg: "#ec6b6b", fg: "#ffffff" } },
];

/**
 * Export your votes as an image, like the Tier List's: rows for Top 3, Want,
 * Neutral and Don't Want, each in Pokédex order. Always your current votes.
 */
export function ExportVotes({ choices, tops }: { choices: Record<string, Choice>; tops: Set<string> }) {
  const rows = (): ImageRow[] =>
    ROWS.map(({ choice, label, color }) => ({
      label,
      color,
      items: LINES.filter((line) => (choice === "top" ? tops.has(line.id) : (choices[line.id] ?? "undecided") === choice)).map(
        (line) => ({ sprite: lineSpriteUrl(line) }),
      ),
    }));
  const count = (choice: Choice) => LINES.filter((line) => (choices[line.id] ?? "undecided") === choice).length;
  return (
    <span className="shrink-0">
      <ImageExport
        title="My votes"
        heading="My Candy Votes"
        subtitle={() => `Want ${count("want")} · Neutral ${count("undecided")} · Don't Want ${count("dont_want")} · ${today()}`}
        sections={() => [{ rows: rows() }]}
        file="my-candy-votes.png"
        label="Export"
      />
    </span>
  );
}
