"use client";

/** Shared List / Grid control across voting and both friend pages. */
export function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (view: "list" | "grid") => void }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-night" role="group" aria-label="Layout">
      {(["list", "grid"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`min-w-[3.25rem] px-3 py-2 text-sm font-semibold ${view === v ? "bg-night text-white dark:bg-sun dark:text-[#5b3e00]" : "pill-idle text-slate-600 dark:text-slate-300"}`}
        >
          {v === "list" ? "List" : "Grid"}
        </button>
      ))}
    </div>
  );
}
