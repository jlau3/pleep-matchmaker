"use client";

import { type CandyLine, type Choice, ISLANDS } from "@/lib/lines";
import { seenBy, type CrowdHint } from "@/lib/crowd";
import type { LineVotes } from "@/lib/tiers";
import { LineCard } from "./LineCard";

/**
 * A candy line released in the last few weeks, pinned above My Votes until the
 * player votes on it, stars it, or closes it. Shows where it spawns and how
 * players have voted on it so far.
 */
export function NewCandyCard({
  line,
  votes,
  voters,
  hint,
  choice,
  starred,
  onChoose,
  onStar,
  onDismiss,
}: {
  line: CandyLine;
  votes?: LineVotes;
  voters: number;
  hint?: CrowdHint;
  choice?: Choice;
  starred: boolean;
  onChoose: (choice: Choice) => void;
  onStar: () => void;
  onDismiss: () => void;
}) {
  const islands = ISLANDS.filter((island) => island.lines.includes(line.id)).map((island) => island.name);
  const wants = votes?.wants ?? 0;
  const dontWants = votes?.dontWants ?? 0;
  // Out of the players who've opened My Votes since it arrived (it grows as they come back), not everyone.
  const seen = seenBy(votes, voters);
  const released = new Date(`${line.addedAt}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section aria-label={`New candy: ${line.name}`} className="mb-4 rounded-[1.75rem] bg-sun/40 p-2">
      <div className="flex items-start justify-between gap-2 px-2 pb-2 pt-1">
        <div className="text-sm">
          <p className="font-extrabold">New candy! {line.name} arrived {released}</p>
          <p className="text-slate-700 dark:text-slate-200">
            {islands.length > 0 ? `Spawns on ${islands.join(", ")}.` : "Spawn islands not listed yet."}{" "}
            {voters > 0 && wants + dontWants > 0 ? (
              <>
                So far: <span className="font-semibold text-want">{wants} want</span>,{" "}
                <span className="font-semibold text-dont">{dontWants} don&apos;t</span>
                {" "}out of {seen} who&apos;ve
                seen it.
              </>
            ) : (
              "Be one of the first to vote."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Hide new candy card for ${line.name}`}
          className="rounded-full px-2 text-lg leading-none text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          ×
        </button>
      </div>
      <LineCard line={line} choice={choice} onChoose={onChoose} starred={starred} onStar={onStar} hint={hint} />
    </section>
  );
}
