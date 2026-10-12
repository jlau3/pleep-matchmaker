"use client";

import { useRef } from "react";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** One big card per line, top to bottom. A first pick scrolls to the next card. */
export function PickFlow({
  lines,
  choices,
  onChoose,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
}) {
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  function choose(index: number, line: CandyLine, choice: Choice) {
    if (!choices[line.id]) {
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
          <LineCard line={line} choice={choices[line.id]} onChoose={(choice) => choose(index, line, choice)} />
        </li>
      ))}
    </ol>
  );
}
