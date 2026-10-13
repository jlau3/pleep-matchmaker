"use client";

/** Cookie holding the My Friends layout ("grid" or absent for list), so the server renders it first time. */
export const FRIENDS_VIEW_COOKIE = "pm_friends_view";

/** List / Grid switch for My Friends on wider screens (phones always get one column). */
export function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (view: "list" | "grid") => void }) {
  function pick(next: "list" | "grid") {
    document.cookie = `${FRIENDS_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    onChange(next);
  }
  return (
    <div className="hidden shrink-0 rounded-full bg-white p-1 shadow-sm md:inline-flex dark:bg-night" role="group" aria-label="Layout">
      {(["list", "grid"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => pick(v)}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${view === v ? "pill-active" : "text-slate-600 dark:text-slate-300"}`}
        >
          {v === "list" ? "List" : "Grid"}
        </button>
      ))}
    </div>
  );
}
