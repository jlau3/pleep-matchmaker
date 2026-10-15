"use client";

import { useRef } from "react";
import { markVoteGuideSeen } from "@/app/actions";
import { MAX_TOP } from "@/lib/lines";

/** Detailed voting help, opened only when the player asks for it. */
export function VoteGuide() {
  const dialog = useRef<HTMLDialogElement>(null);

  const open = () => {
    dialog.current?.showModal();
    void markVoteGuideSeen().catch(() => {});
  };
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" onClick={open} className="text-sm font-semibold underline">
        How to vote
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="vote-guide-title"
        className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="vote-guide-title" className="text-2xl font-extrabold">
              How to vote
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              ×
            </button>
          </div>
          <ul className="space-y-3 text-sm">
            <li>
              <b className="text-want">Want:</b> Pokémon you&apos;re building now or soon and need candy for.
            </li>
            <li>
              <b className="text-meh">Neutral:</b> ones you&apos;d use eventually but aren&apos;t a priority. You&apos;re happy
              to collect their candy slowly. Every candy starts here, and it&apos;s the safe pick when you&apos;re unsure.
            </li>
            <li>
              <b className="text-dont">Don&apos;t Want:</b> ones you&apos;ll never build, or have finished building.
            </li>
            <li>
              <b className="text-sun-deep">★ Top {MAX_TOP}:</b> your favorites. They don&apos;t move anyone&apos;s Tier List,
              but friends see them and can send that candy anyway.
            </li>
          </ul>
          <div className="mt-5 space-y-2 rounded-2xl bg-sun/25 p-4 text-sm">
            <p>
              <b>What your votes change:</b> your friends&apos; Tier Lists and your match %s with other players. Your own
              Tier List comes from your friends&apos; votes, not yours.
            </p>
            <p>
              <b>New Pokémon</b> show up here shortly after they&apos;re released. Check back and vote on them.
            </p>
          </div>
          <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">
            Got it
          </button>
        </div>
      </dialog>
    </>
  );
}
