"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { markMatchGuideSeen } from "@/app/actions";
import { MATCH_HELP_EVENT } from "@/lib/help";
import { usePageHelp } from "@/lib/usePageHelp";

/** Shared guide: opens once per account, then stays available from either friend tab. */
export function FitLegend({ friendsVoted = true, youVoted = true, autoOpen = false }: { friendsVoted?: boolean; youVoted?: boolean; autoOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const titleId = useId();
  const open = useCallback(() => {
    opened.current = true;
    dialog.current?.showModal();
    void markMatchGuideSeen().catch(() => {});
  }, []);
  usePageHelp(MATCH_HELP_EVENT, open);
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
      <dialog ref={dialog} aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}
        className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-6 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
          <h2 id={titleId} className="text-2xl font-extrabold">How Match Scores Work</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
        </div>
      <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <section className="space-y-3">
          <h3 className="text-lg font-extrabold text-ink dark:text-white">Will Their Candy Suit You?</h3>
          <p><b>For you</b> estimates how much of the candy they&apos;d send is candy you Want. <b>Unwanted</b> is the share you marked Don&apos;t Want. The rest is candy you left Neutral.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-lg font-extrabold text-ink dark:text-white">Finding a Good Fit</h3>
          <ul className="list-disc space-y-3 pl-5">
            <li><b>Mutual Fit</b> shows players whose candy suits you and yours suits them. <b>All Players</b> skips that check. A high For you score can still miss Mutual Fit if your candy doesn&apos;t suit them.</li>
            <li><b className="text-amber-600 dark:text-amber-400">Amber coloring</b> on a For you or For them percentage means the wanted share doesn&apos;t outweigh the unwanted penalty.</li>
            <li><b>A dash</b> means that side hasn&apos;t saved votes, or no sending estimate is available. 0% is a real result.</li>
          </ul>
        </section>
        <p>On incoming requests you see how their candy suits you. My Friends shows both directions.</p>
        <details className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-slate-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-slate-200">
          <summary className="cursor-pointer text-base font-bold text-sky-900 dark:text-sky-200">How It&apos;s Calculated</summary>
          <div className="mt-3 space-y-3">
            <p><b>1. Count their friends&apos; Wants.</b> This simplified example leaves out the global baseline.</p>
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">An example sending mix from fourteen Want votes</caption>
              <thead><tr><th scope="col" className="py-2 pr-2">Candy</th><th scope="col" className="py-2 pr-2">Friends who Want it</th><th scope="col" className="py-2">Share of 14 Wants</th></tr></thead>
              <tbody>
                <tr><th scope="row" className="py-1 pr-2 font-normal">Pikachu</th><td>8</td><td>8 ÷ 14 ≈ 57%</td></tr>
                <tr><th scope="row" className="py-1 pr-2 font-normal">Eevee</th><td>4</td><td>4 ÷ 14 ≈ 29%</td></tr>
                <tr><th scope="row" className="py-1 pr-2 font-normal">Bulbasaur</th><td>2</td><td>2 ÷ 14 ≈ 14%</td></tr>
              </tbody>
            </table>
            <p>That&apos;s the estimated mix they&apos;d send. In the full estimate, global votes always contribute the equivalent of five voting friends.</p>
            <p><b>2. Match it to your votes.</b> You Want Pikachu and Bulbasaur, and Don&apos;t Want Eevee:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>For you: (8 + 2) ÷ 14 ≈ <b>71%</b></li>
              <li>Unwanted: 4 ÷ 14 ≈ <b>29%</b></li>
            </ul>
            <p><b>3. Sort.</b> Best for You ranks by For you minus half of Unwanted. Using the exact shares: (10 − ½ × 4) ÷ 14 × 100 ≈ 57.1. Mutual Fit needs this above 0 for both players. Amber means it&apos;s 0 or below.</p>
            <p>Shares display as rounded whole percentages; sorting uses the exact values. Neutral earns no points. Spotlight doesn&apos;t affect the estimate.</p>
          </div>
        </details>
        {!youVoted && <p><Link href="/vote" className="font-semibold underline">Save your candy votes</Link> to find mutual fits, or browse All Players first.</p>}
        {!friendsVoted && <p><Link href="/friends" className="font-semibold underline">Add your Pokémon Sleep friends</Link> and ask them to vote to make your sending estimate more personal.</p>}
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
      </dialog>
    </>
  );
}
