"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { markMatchGuideSeen } from "@/app/actions";

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
      <button type="button" onClick={open} className="text-sm font-semibold underline">How match scores work</button>
      <dialog ref={dialog} aria-labelledby={titleId}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-6 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-2xl font-extrabold">How Match Scores Work</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
        </div>
      <div className="space-y-3 text-sm">
        <p>
          <b className="text-slate-700 dark:text-slate-200">For you</b>: Your wants compared with what their friends want.
        </p>
        <p>
          <b className="text-slate-700 dark:text-slate-200">For them</b>: Their wants compared with what your friends want.
        </p>
        <p><b>&ndash; means not enough votes yet.</b> It doesn&apos;t mean a bad match.</p>
        {!youVoted && (
          <p><Link href="/vote" className="font-semibold underline">Choose the candy you want</Link> to help calculate &ldquo;For you&rdquo;.</p>
        )}
        {!friendsVoted && (
          <p>&ldquo;For them&rdquo; needs your friends&apos; votes. <Link href="/friends" className="font-semibold underline">Add your Pokémon Sleep friends</Link> and ask them to vote.</p>
        )}
      </div>
      <button type="button" onClick={close} className="btn-primary mt-6 w-full py-2">Got it</button>
      </dialog>
    </>
  );
}
