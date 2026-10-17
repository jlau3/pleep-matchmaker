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
        <p><b>For you</b> estimates the share of candy you would receive that matches your Wants. The smaller unwanted percentage is the share you Don&apos;t Want. The rest is Neutral.</p>
        <p><b>The sending estimate</b> uses how many friends Want each candy, topped up by global votes equivalent to five voting friends. We normalize those counts into a mix totaling 100%. Spotlight does not change it. We don&apos;t observe what players actually send.</p>
        <div className="rounded-2xl bg-sun/25 p-4">
          <p><b>Example:</b> an estimated mix of 8 Pikachu, 4 Eevee and 2 Bulbasaur gives about 57%, 29% and 14%. If you Want Pikachu and Bulbasaur and Don&apos;t Want Eevee, your card shows <b>71% For you · 29% unwanted</b>.</p>
        </div>
        <p><b>Best for you</b> sorts by Want share minus half unwanted share. Neutral earns nothing. Amber means that result is zero or below. Shares are rounded to whole percentages; sorting and eligibility use the exact values.</p>
        <p><b>Mutual fit</b> requires positive estimated utility in both directions: Want share must exceed half unwanted share for each player. You see your own fit; the other player sees theirs when they receive your request.</p>
        <p><b>All players</b> includes eligible suggestions without the mutual-fit requirement. Activity, availability, privacy and blocking rules still apply.</p>
        <p><b>Incoming requests</b> show your own estimated fit. <b>My Friends</b> shows both directions, so you can also see how your candy fits their votes.</p>
        <p>A dash means that side has no saved votes, or no sending estimate is available. Saved Neutral votes can give 0% Want; that is different from a dash.</p>
        {!youVoted && <p><Link href="/vote" className="font-semibold underline">Save your candy votes</Link> to find mutual fits, or browse All players first.</p>}
        {!friendsVoted && <p><Link href="/friends" className="font-semibold underline">Add your Pokémon Sleep friends</Link> and ask them to vote to make your sending estimate more personal.</p>}
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
      </dialog>
    </>
  );
}
