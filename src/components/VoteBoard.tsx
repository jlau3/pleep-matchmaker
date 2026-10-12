"use client";

import { useState } from "react";
import { setChoice } from "@/app/actions";
import { type Choice, LINES } from "@/lib/lines";
import { CollectionGrid } from "./CollectionGrid";
import { MatchmakeButton } from "./MatchmakeButton";
import { PickFlow } from "./PickFlow";

/**
 * The Voting tab. Lines without a vote when the page loaded get the big card
 * flow; every line is editable in the grid. Both share one set of votes, and
 * every click saves immediately.
 */
export function VoteBoard({ initial }: { initial: Record<string, Choice> }) {
  const [choices, setChoices] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // Fixed at load so cards don't vanish from under the user as they vote.
  const [unvoted] = useState(() => LINES.filter((line) => !(line.id in initial)));
  const voted = Object.keys(choices).length;

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
      <div className="sticky top-[49px] z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            <strong>{voted}</strong> / {LINES.length} voted
          </span>
          <MatchmakeButton className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-slate-900" />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-want transition-all" style={{ width: `${(voted / LINES.length) * 100}%` }} />
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
              ? "Vote on each candy. Skip anything you don't care about."
              : `${unvoted.length} new or unvoted ${unvoted.length === 1 ? "candy" : "candies"}.`}
          </p>
          <PickFlow lines={unvoted} choices={choices} onChoose={choose} />
          <div className="mx-auto mt-10 max-w-md text-center">
            <MatchmakeButton className="block w-full rounded-2xl bg-want px-6 py-4 text-lg font-bold text-white" />
            <p className="mt-2 text-xs text-slate-500">Anything you skipped is saved as undecided.</p>
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
