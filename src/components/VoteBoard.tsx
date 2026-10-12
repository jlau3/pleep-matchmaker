"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { setChoice } from "@/app/actions";
import { CHOICE_LABEL, type Choice, LINES } from "@/lib/lines";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import { CollectionGrid } from "./CollectionGrid";
import { PickFlow } from "./PickFlow";

type Filter = "all" | Choice;
type View = "list" | "grid";
const VIEW_KEY = "pm_vote_view";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: CHOICE_LABEL.want },
  { value: "dont_want", label: CHOICE_LABEL.dont_want },
  { value: "undecided", label: CHOICE_LABEL.undecided },
];

const pill = (active: boolean) =>
  `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-700"}`;

/**
 * Profile > My Votes. Every line is already saved (Undecided by default).
 * List view is one big card per line in a single column; grid view is a
 * compact multi-column layout. The choice is remembered per browser. Order is
 * fixed at load: new candies, then undecided, then decided, so cards don't
 * jump around while voting. Every click saves immediately.
 */
export function VoteBoard({ initial, newIds }: { initial: Record<string, Choice>; newIds: string[] }) {
  const [choices, setChoices] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      // Storage unavailable (private mode, in-app browsers): keep the default.
    }
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  }

  const [ordered] = useState(() => {
    const rank = (id: string) => (newIds.includes(id) ? 0 : (initial[id] ?? "undecided") === "undecided" ? 1 : 2);
    return [...LINES].sort((a, b) => rank(a.id) - rank(b.id) || a.dex - b.dex);
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((line) => {
      if (filter !== "all" && (choices[line.id] ?? "undecided") !== filter) return false;
      return !q || line.members.some((member) => member.name.toLowerCase().includes(q));
    });
  }, [ordered, choices, query, filter]);

  const counts = { want: 0, dont_want: 0, undecided: 0 };
  for (const line of LINES) counts[choices[line.id] ?? "undecided"]++;

  async function choose(lineId: string, choice: Choice) {
    const previous = choices[lineId];
    setError(null);
    setChoices((current) => ({ ...current, [lineId]: choice }));
    let failure: string | undefined;
    try {
      failure = (await setChoice(lineId, choice)).error;
    } catch (e) {
      rethrowIfNavigation(e);
      failure = SAVE_FAILED;
    }
    if (failure) {
      setError(failure);
      setChoices((current) => {
        const reverted = { ...current };
        if (previous) reverted[lineId] = previous;
        else delete reverted[lineId];
        return reverted;
      });
    }
  }

  return (
    <div>
      <div className="sticky top-[49px] z-10 -mx-4 mb-4 bg-sky/95 px-4 py-2 shadow-sm backdrop-blur dark:bg-night-deep/95">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex flex-wrap gap-x-3">
            <span className="text-want">
              <strong>{counts.want}</strong> want
            </span>
            <span className="text-dont">
              <strong>{counts.dont_want}</strong> don&apos;t want
            </span>
            <span className="text-meh">
              <strong>{counts.undecided}</strong> undecided
            </span>
          </span>
          <Link href="/matches" className="btn-primary shrink-0 px-4 py-1.5">
            Matchmake
          </Link>
        </div>
        {error && (
          <div role="alert" className="mt-2 flex items-center justify-between gap-3 text-sm text-dont">
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()} className="shrink-0 font-bold underline">
              Refresh
            </button>
          </div>
        )}
      </div>

      <p className="mb-4 text-center text-sm text-slate-500">
        {newIds.length === LINES.length
          ? "Pick Want or Don't Want on the candies you care about. Everything else stays Undecided."
          : newIds.length > 0
            ? `${newIds.length} new ${newIds.length === 1 ? "candy" : "candies"} since your last visit, shown first.`
            : "Undecided candies are shown first."}
      </p>

      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pokémon"
            className="field min-w-0 flex-1"
          />
          <div className="inline-flex shrink-0 rounded-full bg-white p-1 shadow-sm dark:bg-night" role="group" aria-label="Layout">
            {(["list", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${view === v ? "pill-active" : "text-slate-600 dark:text-slate-300"}`}
              >
                {v === "list" ? "List" : "Grid"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)} className={pill(filter === f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-slate-500">Nothing here.</p>
      ) : view === "list" ? (
        <PickFlow lines={visible} choices={choices} onChoose={choose} />
      ) : (
        <CollectionGrid lines={visible} choices={choices} onChoose={choose} />
      )}

      <div className="mx-auto mt-10 max-w-md text-center">
        <Link href="/matches" className="btn-primary block w-full px-6 py-4 text-lg">
          Matchmake
        </Link>
      </div>
    </div>
  );
}
