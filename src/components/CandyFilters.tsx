"use client";

import { ISLANDS, SLEEP_TYPES, SLEEP_TYPE_LABEL, type SleepType } from "@/lib/lines";

/** Optional filters: tap a selected sleep type again to clear it. */
export function CandyFilters({ islandId, sleepType, onIsland, onSleep }: {
  islandId: string;
  sleepType: SleepType | null;
  onIsland: (value: string) => void;
  onSleep: (value: SleepType | null) => void;
}) {
  return <div className="flex flex-wrap items-center gap-3">
    <label className="flex min-w-0 items-center gap-2 text-sm font-semibold">
      Island
      <select aria-label="Island" value={islandId} onChange={(event) => onIsland(event.target.value)} className="field min-w-0 max-w-56 py-1.5 text-sm">
        <option value="">All Islands</option>
        {ISLANDS.map((island) => <option key={island.id} value={island.id}>{island.name}</option>)}
      </select>
    </label>
    <div role="group" aria-label="Sleep Type" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">Sleep Type</span>
      {SLEEP_TYPES.map((type) => <button key={type} type="button" aria-pressed={sleepType === type}
        title={sleepType === type ? `${SLEEP_TYPE_LABEL[type]} (tap again for all sleep types)` : SLEEP_TYPE_LABEL[type]}
        onClick={() => onSleep(sleepType === type ? null : type)}
        className={`rounded-full border px-3 py-1 text-sm ${sleepType === type ? "pill-active border-transparent" : "pill-idle border-slate-300 dark:border-slate-700"}`}>
        {SLEEP_TYPE_LABEL[type]}
      </button>)}
    </div>
  </div>;
}
