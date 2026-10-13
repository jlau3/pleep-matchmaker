"use client";

import type { CrowdHint } from "@/lib/crowd";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** Compact multi-column grid of vote cards. */
export function CollectionGrid({
  lines,
  choices,
  onChoose,
  tops,
  onStar,
  hints,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
  tops: Set<string>;
  onStar: (lineId: string) => void;
  /** Crowd hints per line id, when "Show what others pick" is on. */
  hints?: Record<string, CrowdHint>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lines.map((line) => (
        <LineCard
          key={line.id}
          line={line}
          choice={choices[line.id]}
          onChoose={(c) => onChoose(line.id, c)}
          starred={tops.has(line.id)}
          onStar={() => onStar(line.id)}
          hint={hints?.[line.id]}
          compact
        />
      ))}
    </div>
  );
}
