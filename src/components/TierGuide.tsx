"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { FIXED_SCORE_CUTOFFS, POINTS, TIER_STYLES, TIER_STYLE_LABEL, TIER_STYLE_DESCRIPTION } from "@/lib/tiers";

/** First signed-in visit per account/browser; public visitors can open help on demand. */
export function TierGuide({ userId }: { userId: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const titleId = useId();
  const storageKey = `pm_tier_guide_seen:${userId ?? "public"}`;
  const open = useCallback(() => {
    opened.current = true;
    dialog.current?.showModal();
    try { localStorage.setItem(storageKey, "1"); } catch { /* Help still works without storage. */ }
  }, [storageKey]);

  useEffect(() => {
    if (!userId || opened.current) return;
    try { if (localStorage.getItem(storageKey) === "1") return; } catch { return; }
    const showWhenReady = () => {
      if (!opened.current && !document.querySelector("dialog[open]")) open();
    };
    showWhenReady();
    const observer = new MutationObserver(showWhenReady);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
    return () => observer.disconnect();
  }, [userId, storageKey, open]);

  const close = () => dialog.current?.close();
  return <>
    <button type="button" onClick={open} className="text-sm font-semibold underline">How to use the Tier List</button>
    <dialog ref={dialog} aria-labelledby={titleId}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-6 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-2xl font-extrabold">How to Use the Tier List</h2>
        <button type="button" onClick={close} aria-label="Close" className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
      </div>
      <div className="space-y-3 text-sm">
        <p><b>Everyone</b> shows the candy active players want most. You can use it before any friends join.</p>
        <p><b>My Friends</b> uses your accepted friends&apos; votes. Your own votes shape their Tier Lists.</p>
        <p><b>Scoring:</b> Want adds {POINTS.want} points, Neutral adds {POINTS.neutral}, and Don&apos;t Want subtracts {Math.abs(POINTS.dontWant)}. Standard and Fixed Scores put negative totals in Avoid.</p>
        <p><b>Standard (Recommended)</b> is the shared ranking: negative totals go to Avoid, then the rest split into percentile tiers. Choose it when comparing lists with other players. Friend comparisons elsewhere also use Standard.</p>
        <p><b>Fixed Scores</b> is an optional view: S starts at {FIXED_SCORE_CUTOFFS.S}/100, A at {FIXED_SCORE_CUTOFFS.A}, B at {FIXED_SCORE_CUTOFFS.B}, and C covers lower scores with nonnegative totals. All-Neutral scores {FIXED_SCORE_CUTOFFS.B}, so it lands in B. Negative totals still go to Avoid.</p>
        {TIER_STYLES.filter((style) => style !== "standard" && style !== "fixed").map((style) => <p key={style}><b>{TIER_STYLE_LABEL[style]}:</b> {TIER_STYLE_DESCRIPTION[style]}</p>)}
        <p><b>Filters:</b> Pick an Island or Sleep Type to narrow the Pokémon shown. Standard and Percentile Only can change tiers with the selection. Fixed Scores and Consensus keep the same rules. Tap a selected filter again to clear it.</p>
        <p><b>Export Image:</b> Make a shareable image of the current list with your selected filters and ranking style. Preview it, then download, copy, or share using your browser&apos;s available options.</p>
        <p><b>Top 3</b> shows the candies players marked as their Top 3 above the ranked tiers. Candy stays unranked in Everyone until 10 active players have saved a vote for it. Neutral counts too.</p>
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
    </dialog>
  </>;
}
