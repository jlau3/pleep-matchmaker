"use client";

import { useRef, useState, useTransition } from "react";
import { adoptCrowdVotes } from "@/app/actions";
import { CROWD_MARGIN, CROWD_MIN_SHARE } from "@/lib/crowd";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import { markVotesChanged } from "@/lib/votesChanged";

/**
 * "Copy everyone's votes" on My Votes: a short pitch, then a confirm popup
 * that spells out what changes before anything is saved.
 */
export function CrowdVotesCard({
  voters,
  counts,
}: {
  voters: number;
  counts: { want: number; dont_want: number; undecided: number };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adopt() {
    setError(null);
    startTransition(async () => {
      let failure: string | undefined;
      try {
        failure = (await adoptCrowdVotes()).error;
      } catch (e) {
        rethrowIfNavigation(e);
        failure = SAVE_FAILED;
      }
      if (failure) setError(failure);
      else {
        markVotesChanged();
        dialog.current?.close();
      }
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-night">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <b className="text-ink dark:text-white">Not sure where to start?</b> Copy how the {voters} active players vote, then
        tweak it.
      </p>
      <button
        type="button"
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
        className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-sky dark:border-slate-600 dark:hover:bg-night-deep"
      >
        Copy everyone&apos;s votes
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget && !pending) dialog.current?.close();
        }}
        aria-labelledby="crowd-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
      >
        <div className="space-y-4 p-6">
          <h2 id="crowd-title" className="text-xl font-extrabold">
            Start from everyone&apos;s votes?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your votes will match how the {voters} active players lean:
          </p>
          <ul className="space-y-1 text-sm">
            <li>
              <b className="text-want">{counts.want} Want</b>: candies most players want
            </li>
            <li>
              <b className="text-dont">{counts.dont_want} Don&apos;t Want</b>: candies most players pass on
            </li>
            <li>
              <b className="text-meh">{counts.undecided} Neutral</b>: candies that split the room, or few feel strongly
              about
            </li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This replaces your current votes. Your Top 3 stay as they are, and you can change any vote whenever you like.
          </p>
          <p className="text-xs text-slate-500">
            A side wins when at least {Math.round(CROWD_MIN_SHARE * 100)}% of players pick it and they outnumber the other
            side {CROWD_MARGIN} to 1.
          </p>
          {error && (
            <p role="alert" className="text-sm text-dont">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={adopt} disabled={pending} className="btn-primary px-5 py-2">
              {pending ? "Copying…" : "Copy their votes"}
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              disabled={pending}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Keep mine
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
