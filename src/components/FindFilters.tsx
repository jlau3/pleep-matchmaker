"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BrowseOptions } from "@/lib/browse";

/** Optional, combinable filters; no selected filters means All Players. */
export function FindFilters({ opts, onChange }: { opts: BrowseOptions; onChange: (next: Partial<BrowseOptions>) => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [right, setRight] = useState(0);
  const place = () => {
    if (!menu.current?.open || !panel.current) return;
    const edge = menu.current.querySelector("summary")!.getBoundingClientRect().right;
    setRight(Math.min(0, edge - panel.current.getBoundingClientRect().width - 16));
  };
  const count = Number(!opts.everyone) + Number(opts.activeWeek) + Number(opts.votingFriends) + Number(opts.spotlightSafe) + Number(opts.newPlayers) + Number(opts.hideDeclined);
  useLayoutEffect(place, [count, opts.sort]);
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
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const options = [
    { label: "Mutual Fit", checked: !opts.everyone, update: { everyone: !opts.everyone }, hint: "Their estimated candy suits you, and yours suits them." },
    { label: "Active This Week", checked: opts.activeWeek, update: { activeWeek: !opts.activeWeek }, hint: "Visited the site in the past 7 days." },
    { label: "None of My Spotlight in F", checked: opts.spotlightSafe, update: { spotlightSafe: !opts.spotlightSafe }, hint: "Every selected Spotlight candy ranks C or higher on their friends' Tier List. Unranked candies are excluded." },
    { label: "New to Pleep", checked: opts.newPlayers, update: { newPlayers: !opts.newPlayers }, hint: "Joined in the past two weeks." },
    { label: "Hide Players I've Declined or Who Declined Me", checked: opts.hideDeclined, update: { hideDeclined: !opts.hideDeclined }, hint: "Hide declined requests in either direction. Cleared or resent requests are not included." },
    { label: "Has Voting Friends", checked: opts.votingFriends, update: { votingFriends: !opts.votingFriends }, hint: "Their candy estimate includes votes from at least one friend." },
  ];
  return <details ref={menu} onToggle={place} className="relative shrink-0 text-sm">
    <summary className={`cursor-pointer rounded-xl border px-3 py-2 font-semibold ${count ? "pill-active border-transparent" : "pill-idle border-slate-300 dark:border-slate-700"}`}>
      Filters{count > 0 ? ` (${count})` : ""}
    </summary>
    <div ref={panel} style={{ right }} className="absolute top-full z-20 mt-1 max-h-[65dvh] overflow-y-auto w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-cream p-3 shadow-lg dark:border-slate-700 dark:bg-night">
      <fieldset className="space-y-3">
        <legend className="sr-only">Filter players</legend>
        {options.map((option) => <label key={option.label} className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" checked={option.checked} onChange={() => onChange(option.update)} className="mt-1 h-4 w-4 shrink-0 accent-want" />
          <span><b>{option.label}</b><span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{option.hint}</span></span>
        </label>)}
      </fieldset>
      {count > 0 && <button type="button" className="mt-3 font-semibold underline"
        onClick={() => onChange({ everyone: true, activeWeek: false, votingFriends: false, spotlightSafe: false, newPlayers: false, hideDeclined: false })}>Clear Filters</button>}
    </div>
  </details>;
}
