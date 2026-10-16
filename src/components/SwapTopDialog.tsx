"use client";

import { useEffect } from "react";
import { type CandyLine, lineSpriteUrl, MAX_TOP } from "@/lib/lines";

/**
 * Shown when a player stars a line while their Top 3 Spotlight is full: pick which star
 * to give up for it, or cancel. Bottom sheet on phones, centered on desktop.
 */
export function SwapTopDialog({
  incoming,
  tops,
  onSwap,
  onCancel,
}: {
  incoming: CandyLine;
  tops: CandyLine[];
  onSwap: (outId: string) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
        className="card w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <img src={lineSpriteUrl(incoming)} alt="" className="h-12 w-12 rounded-full bg-sky object-contain dark:bg-night" />
          <div>
            <h2 id="swap-title" className="font-bold">
              Add {incoming.name} To Your Top {MAX_TOP} Spotlight?
            </h2>
            <p className="text-sm text-slate-500">Your Top {MAX_TOP} Spotlight is full. Pick one to swap out.</p>
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {tops.map((line) => (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => onSwap(line.id)}
                aria-label={`Swap out ${line.name}`}
                className="flex w-full flex-col items-center rounded-2xl border-2 border-transparent bg-white p-2 hover:border-dont dark:bg-night-deep"
              >
                <img src={lineSpriteUrl(line)} alt="" className="h-12 w-12 rounded-full bg-sky object-contain dark:bg-night" />
                <span className="mt-1 w-full truncate text-center text-xs font-semibold">{line.name}</span>
                <span className="text-[11px] text-dont">Swap out</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="mt-3 w-full rounded-full border border-slate-300 py-2 text-sm font-semibold dark:border-slate-600"
        >
          Keep my Top {MAX_TOP} Spotlight
        </button>
      </div>
    </div>
  );
}
