"use client";

import { useEffect, useMemo, useState } from "react";
import { FRIEND_SORT_HINTS, FRIEND_SORTS, type FriendSort } from "@/lib/friendSort";
import { SortMenu } from "./SortMenu";
import { ViewToggle } from "./ViewToggle";

const VIEW_KEY = "pm_friends_view";

export interface FriendItem {
  id: string;
  /** Sort key per order, higher first (see friendRank). */
  ranks: Record<FriendSort, number>;
  /** The friend's card, rendered on the server. */
  card: React.ReactNode;
}

/**
 * My Friends list with its sort dropdown and shared List/Grid switch. The cards and
 * their sort keys arrive from the server once; switching order or layout just
 * reorders them in the browser, so it's instant. The order goes in the URL
 * (replaceState) so a reload keeps it.
 */
export function FriendsBoard({
  items,
  initialSort,
}: {
  items: FriendItem[];
  initialSort: FriendSort;
}) {
  const [sort, setSort] = useState(initialSort);
  const [view, setView] = useState<"list" | "grid">("list");

  // Remember the layout per browser, like the voting page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      /* Storage unavailable: keep the default. */
    }
  }, []);

  function changeView(next: "list" | "grid") {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* Not remembered; fine. */
    }
  }
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
          <div className="flex items-center justify-between gap-3 text-sm">
            <SortMenu value={sort} options={FRIEND_SORTS} hints={FRIEND_SORT_HINTS} onChange={pick} />
            <span className="hidden md:inline-flex"><ViewToggle view={view} onChange={changeView} /></span>
          </div>
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
