"use client";

import { useEffect, useRef } from "react";
import type { BrowseOptions } from "@/lib/browse";

/** Optional, combinable filters; no selected filters means All Players. */
export function FindFilters({ opts, onChange }: { opts: BrowseOptions; onChange: (next: Partial<BrowseOptions>) => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const count = Number(!opts.everyone) + Number(opts.activeWeek) + Number(opts.votingFriends);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const options = [
    { label: "Mutual Fit", checked: !opts.everyone, update: { everyone: !opts.everyone }, hint: "Their estimated candy suits you, and yours suits them." },
    { label: "Active This Week", checked: opts.activeWeek, update: { activeWeek: !opts.activeWeek }, hint: "Visited the site in the past 7 days." },
    { label: "Has Voting Friends", checked: opts.votingFriends, update: { votingFriends: !opts.votingFriends }, hint: "Their candy estimate includes votes from at least one friend." },
  ];
  return <details ref={menu} className="shrink-0 text-sm">
    <summary className={`cursor-pointer rounded-xl border px-3 py-2 font-semibold ${count ? "pill-active border-transparent" : "pill-idle border-slate-300 dark:border-slate-700"}`}>
      Filters{count > 0 ? ` (${count})` : ""}
    </summary>
    <div className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-cream p-3 shadow-lg dark:border-slate-700 dark:bg-night">
      <fieldset className="space-y-3">
        <legend className="sr-only">Filter players</legend>
        {options.map((option) => <label key={option.label} className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" checked={option.checked} onChange={() => onChange(option.update)} className="mt-1 h-4 w-4 shrink-0 accent-want" />
          <span><b>{option.label}</b><span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{option.hint}</span></span>
        </label>)}
      </fieldset>
      {count > 0 && <button type="button" className="mt-3 font-semibold underline"
        onClick={() => onChange({ everyone: true, activeWeek: false, votingFriends: false })}>Clear Filters</button>}
    </div>
  </details>;
}
