"use client";

import { useEffect, useState } from "react";

type View = "list" | "grid";
const VIEW_KEY = "pleep.findNewView";

/**
 * Find New's List / Grid switch. Both layouts are rendered on the server (same
 * players, same order); this picks one and remembers it in this browser.
 */
export function BrowseLayout({ list, grid }: { list: React.ReactNode; grid: React.ReactNode }) {
  // List until the saved choice loads, so the server and first client render agree.
  const [view, setView] = useState<View>("list");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "grid") setView("grid");
    } catch {}
  }, []);
  function choose(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }
  const pill = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => choose(v)}
      aria-pressed={view === v}
      className={`rounded-full border px-3 py-1 ${
        view === v
          ? "border-transparent bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
          : "border-slate-300 hover:bg-white/60 dark:border-slate-700 dark:hover:bg-night"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm" role="group" aria-label="Layout">
        <span className="text-slate-500">View</span>
        {pill("list", "List")}
        {pill("grid", "Grid")}
      </div>
      {view === "list" ? list : grid}
    </div>
  );
}
