"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { markMatchGuideSeen } from "@/app/actions";

/** Shared guide: opens once per account, then stays available from either friend tab. */
export function FitLegend({ friendsVoted = true, youVoted = true, autoOpen = false, compact = false }: { friendsVoted?: boolean; youVoted?: boolean; autoOpen?: boolean; compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const titleId = useId();
  const open = useCallback(() => {
    opened.current = true;
    dialog.current?.showModal();
    void markMatchGuideSeen().catch(() => {});
  }, []);
  useEffect(() => {
    if (!autoOpen || opened.current) return;
    const showWhenReady = () => {
      if (!opened.current && !document.querySelector("dialog[open]")) open();
    };
    showWhenReady();
    const observer = new MutationObserver(showWhenReady);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
    return () => observer.disconnect();
  }, [autoOpen, open]);
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" onClick={open} aria-label="How match scores work" title="How match scores work" className={compact ? "flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-sm font-bold dark:border-slate-700" : "text-sm font-semibold underline"}>{compact ? "?" : "How match scores work"}</button>
      <dialog ref={dialog} aria-labelledby={titleId}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-6 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-2xl font-extrabold">How Match Scores Work</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
        </div>
      <div className="space-y-3 text-sm">
        <p>
          <b className="text-slate-700 dark:text-slate-200">For them</b>: how well the candy you&apos;d send (what your friends want) fits their votes.{" "}
          <b className="text-slate-700 dark:text-slate-200">For you</b>: the same, flipped: what their friends want against your votes.
        </p>
        <div className="rounded-2xl bg-sun/25 p-4">
          <p className="font-bold">How For them is worked out</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Your friends&apos; votes give every candy a demand score. Their most-wanted candy is 100; the rest score relative to it.</li>
            <li>The other player earns the score of each candy they Want. Neutral counts for nothing.</li>
            <li>That&apos;s divided by the most they could earn: 100 per Want. Each Don&apos;t Want adds its score to that total, so it pulls the % down.</li>
          </ol>
          <p className="mt-2">
            <b>Example:</b> your friends score Pikachu 100, Eevee 60, Bulbasaur 20. The other player Wants Pikachu and Bulbasaur
            and Don&apos;t Wants Eevee. Earned: 100 + 20 = 120. Most possible: 2 Wants × 100, plus Eevee&apos;s 60 = 260.
            120 ÷ 260 = <b>46%</b>.
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            So it&apos;s about the quality of their Wants, not how many: one Want on your friends&apos; top candy is 100%.
          </p>
        </div>
        <p>
          <b>Few friends voting yet?</b> Scores lean on global votes until more friends vote.
        </p>
        <p><b>For you needs your votes. For them needs theirs.</b> A dash means there isn&apos;t enough voting data to calculate that score; it doesn&apos;t mean a bad match.</p>
        {!youVoted && (
          <p><Link href="/vote" className="font-semibold underline">Choose the candy you want</Link> to help calculate &ldquo;For you&rdquo;.</p>
        )}
        {!friendsVoted && (
          <p>Want matches based on your friends? <Link href="/friends" className="font-semibold underline">Add your Pokémon Sleep friends</Link> and ask them to vote.</p>
        )}
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
      </dialog>
    </>
  );
}
