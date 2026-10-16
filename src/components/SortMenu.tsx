"use client";

import { useEffect, useRef } from "react";

/** Shared sort picker for both friend pages; explanations stay with their options. */
export function SortMenu<T extends string>({ value, options, hints, onChange }: {
  value: T;
  options: readonly (readonly [T, string])[];
  hints: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return (
    <details ref={menu} className="relative min-w-0 text-sm">
      <summary className="max-w-[13rem] cursor-pointer truncate rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-night">
        Sort: {options.find(([id]) => id === value)?.[1]}
      </summary>
      <fieldset className="absolute left-0 z-20 mt-2 w-[min(23rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-slate-300 bg-cream p-3 shadow-lg dark:border-slate-700 dark:bg-night">
        <legend className="sr-only">Sort players</legend>
        {options.map(([id, label]) => <label key={id} className="flex cursor-pointer items-start gap-2">
          <input type="radio" name="player-sort" value={id} checked={value === id} className="mt-1 accent-want"
            onChange={() => { onChange(id); if (menu.current) menu.current.open = false; menu.current?.querySelector("summary")?.focus(); }} />
          <span><b>{label}</b><span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{hints[id]}</span></span>
        </label>)}
      </fieldset>
    </details>
  );
}
