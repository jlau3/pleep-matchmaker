"use client";

import { useCallback, useEffect, useId, useRef } from "react";

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
        <h2 id={titleId} className="text-2xl font-extrabold">How to use the Tier List</h2>
        <button type="button" onClick={close} aria-label="Close" className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
      </div>
      <div className="space-y-3 text-sm">
        <p><b>Everyone</b> shows the candy active players want most. You can use it before any friends join.</p>
        <p><b>My Friends</b> uses your accepted friends&apos; votes. Your own votes shape their Tier Lists.</p>
        <p><b>Filters:</b> Pick an Island or Sleep Type to narrow the Pokémon shown. The tiers update for that selection. Tap a selected filter again to clear it.</p>
        <p><b>Export Image:</b> Make a shareable image of the current list with your selected filters. Preview it, then download, copy, or share using your browser&apos;s available options.</p>
        <p><b>Top 3</b> shows players&apos; personal favorites above the ranked tiers. Candies with fewer than 10 active players&apos; saved choices stay unranked in Everyone.</p>
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
    </dialog>
  </>;
}
