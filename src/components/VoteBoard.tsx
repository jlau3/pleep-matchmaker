"use client";

import { useState } from "react";
import { setChoice } from "@/app/actions";
import { type Choice, LINES } from "@/lib/lines";
import { CollectionGrid } from "./CollectionGrid";
import Link from "next/link";
import { PickFlow } from "./PickFlow";

/**
 * Profile > My Votes. Every line is saved as Undecided up front; lines that
 * were new on this visit get the big card flow, and every line is editable in
 * the grid. Both share one set of votes, and every click saves immediately.
 */
export function VoteBoard({ initial, newIds }: { initial: Record<string, Choice>; newIds: string[] }) {
  const [choices, setChoices] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // Fixed at load so cards don't vanish from under the user as they vote.
  const [unvoted] = useState(() => LINES.filter((line) => newIds.includes(line.id)));
  const counts = { want: 0, dont_want: 0, undecided: 0 };
  for (const line of LINES) counts[choices[line.id] ?? "undecided"]++;

  async function choose(lineId: string, choice: Choice) {
    const previous = choices[lineId];
    setError(null);
    setChoices((current) => ({ ...current, [lineId]: choice }));
    const result = await setChoice(lineId, choice);
    if (result.error) {
      setError(result.error);
      setChoices((current) => {
        const reverted = { ...current };
        if (previous) reverted[lineId] = previous;
        else delete reverted[lineId];
        return reverted;
      });
    }
  }

  const grid = <CollectionGrid choices={choices} onChoose={choose} />;

  return (
    <div>
      <div className="sticky top-[49px] z-10 -mx-4 mb-4 bg-sky/95 px-4 py-2 shadow-sm backdrop-blur dark:bg-night-deep/95">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex flex-wrap gap-x-3">
            <span className="text-want">
              <strong>{counts.want}</strong> want
            </span>
            <span className="text-dont">
              <strong>{counts.dont_want}</strong> don&apos;t want
            </span>
            <span className="text-meh">
              <strong>{counts.undecided}</strong> undecided
            </span>
          </span>
          <Link href="/matches" className="btn-primary shrink-0 px-4 py-1.5">
            Matchmake
          </Link>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-dont">
            {error}
          </p>
        )}
      </div>

      {unvoted.length > 0 ? (
        <>
          <p className="mb-4 text-center text-sm text-slate-500">
            {unvoted.length === LINES.length
              ? "Pick Want or Don't Want on the candies you care about. Everything else stays Undecided."
              : `${unvoted.length} new ${unvoted.length === 1 ? "candy" : "candies"} since your last visit.`}
          </p>
          <PickFlow lines={unvoted} choices={choices} onChoose={choose} />
          <div className="mx-auto mt-10 max-w-md text-center">
            <Link href="/matches" className="btn-primary block w-full px-6 py-4 text-lg">
              Matchmake
            </Link>
            <p className="mt-2 text-xs text-slate-500">Everything starts as Undecided. Only tap what you want or don&apos;t want.</p>
          </div>
          {unvoted.length < LINES.length && (
            <details className="mt-10">
              <summary className="text-lg font-semibold">Edit all votes</summary>
              <div className="mt-4">{grid}</div>
            </details>
          )}
        </>
      ) : (
        grid
      )}
    </div>
  );
}
