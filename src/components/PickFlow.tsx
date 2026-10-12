"use client";

import { useRef } from "react";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** One big card per line in a single column. Deciding an undecided card scrolls to the next one. */
export function PickFlow({
  lines,
  choices,
  onChoose,
  tops,
  onStar,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
  tops: Set<string>;
  onStar: (lineId: string) => void;
}) {
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  function choose(index: number, line: CandyLine, choice: Choice) {
    if ((choices[line.id] ?? "undecided") === "undecided") {
      const next = lines[index + 1];
      if (next) cardRefs.current.get(next.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    onChoose(line.id, choice);
  }

  return (
    <ol className="mx-auto max-w-md space-y-6">
      {lines.map((line, index) => (
        <li
          key={line.id}
          ref={(el) => {
            if (el) cardRefs.current.set(line.id, el);
          }}
        >
          <LineCard
            line={line}
            choice={choices[line.id]}
            onChoose={(choice) => choose(index, line, choice)}
            starred={tops.has(line.id)}
            onStar={() => onStar(line.id)}
          />
        </li>
      ))}
    </ol>
  );
}
