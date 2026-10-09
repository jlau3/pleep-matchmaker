"use client";

import { useRef, useState } from "react";
import { setChoice } from "@/app/actions";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";
import { MatchmakeButton } from "./MatchmakeButton";

/**
 * One card per unsorted line, top to bottom. Each click saves immediately and,
 * on a first pick, scrolls to the next card.
 */
export function PickFlow({ lines, total, alreadySorted }: { lines: CandyLine[]; total: number; alreadySorted: number }) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const sorted = alreadySorted + Object.keys(choices).length;

  async function choose(index: number, line: CandyLine, choice: Choice) {
    const previous = choices[line.id];
    setChoices((current) => ({ ...current, [line.id]: choice }));
    if (!previous) {
      const next = lines[index + 1];
      if (next) cardRefs.current.get(next.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const result = await setChoice(line.id, choice);
    if (result.error) {
      setError(result.error);
      setChoices((current) => {
        const reverted = { ...current };
        if (previous) reverted[line.id] = previous;
        else delete reverted[line.id];
        return reverted;
      });
    }
  }

  return (
    <div>
      <div className="sticky top-[49px] z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            <strong>{sorted}</strong> / {total} sorted
          </span>
          <MatchmakeButton className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-slate-900" />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-want transition-all" style={{ width: `${(sorted / total) * 100}%` }} />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-dont">
            {error}
          </p>
        )}
      </div>

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

      <div className="mx-auto mt-10 max-w-md text-center">
        <MatchmakeButton className="block w-full rounded-2xl bg-want px-6 py-4 text-lg font-bold text-white" />
        <p className="mt-2 text-xs text-slate-500">Anything you skipped is saved as undecided.</p>
      </div>
    </div>
  );
}
