"use client";

import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** Compact multi-column grid of vote cards. */
export function CollectionGrid({
  lines,
  choices,
  onChoose,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lines.map((line) => (
        <LineCard key={line.id} line={line} choice={choices[line.id]} onChoose={(c) => onChoose(line.id, c)} compact />
      ))}
    </div>
  );
}
