"use client";

import { useMemo, useState } from "react";
import { FRIEND_SORT_HINTS, FRIEND_SORTS, type FriendSort } from "@/lib/friendSort";
import { ViewToggle } from "./ViewToggle";

export interface FriendItem {
  id: string;
  /** Sort key per order, higher first (see friendRank). */
  ranks: Record<FriendSort, number>;
  /** The friend's card, rendered on the server. */
  card: React.ReactNode;
}

/**
 * My Friends list with its sort pills and List/Grid switch. The cards and
 * their sort keys arrive from the server once; switching order or layout just
 * reorders them in the browser, so it's instant. The order goes in the URL
 * (replaceState) so a reload keeps it.
 */
export function FriendsBoard({
  items,
  initialSort,
  initialView,
}: {
  items: FriendItem[];
  initialSort: FriendSort;
  initialView: "list" | "grid";
}) {
  const [sort, setSort] = useState(initialSort);
  const [view, setView] = useState(initialView);
  // Stable sort: ties keep the order friends were added in.
  const sorted = useMemo(() => [...items].sort((a, b) => b.ranks[sort] - a.ranks[sort]), [items, sort]);

  function pick(next: FriendSort) {
    setSort(next);
    const url = new URL(window.location.href);
    if (next === "fit") url.searchParams.delete("sort");
    else url.searchParams.set("sort", next);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <>
      {items.length > 1 && (
        <div className="mb-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Sort</span>
            {FRIEND_SORTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={sort === id}
                className={`rounded-full border px-3 py-1 ${
                  sort === id
                    ? "border-transparent bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
                    : "border-slate-300 hover:bg-white/60 dark:border-slate-700 dark:hover:bg-night"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto">
              <ViewToggle view={view} onChange={setView} />
            </span>
          </div>
          <p className="text-xs text-slate-500">{FRIEND_SORT_HINTS[sort]}</p>
        </div>
      )}
      <ul className={view === "grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
        {sorted.map((item) => (
          <li key={item.id} className="card p-4">
            {item.card}
          </li>
        ))}
      </ul>
    </>
  );
}
