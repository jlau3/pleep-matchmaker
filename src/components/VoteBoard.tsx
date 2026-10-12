"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { setChoice, setTop, swapTop } from "@/app/actions";
import { CHOICE_LABEL, type Choice, LINES, LINES_BY_ID, lineSpriteUrl, MAX_TOP } from "@/lib/lines";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import type { LineVotes } from "@/lib/tiers";
import { CollectionGrid } from "./CollectionGrid";
import { PickFlow } from "./PickFlow";
import { NewCandyCard } from "./NewCandyCard";
import { StarButton } from "./StarButton";
import { SwapTopDialog } from "./SwapTopDialog";

type Filter = "all" | Choice;
type View = "list" | "grid";
const VIEW_KEY = "pm_vote_view";
const NEW_DISMISSED_KEY = "pm_new_candy_dismissed";

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
 * compact multi-column layout. The choice is remembered per browser. Lines
 * are always in dex order. The star on each card picks up to MAX_TOP wants as
 * the player's Top 3, shown pinned above the list. Every click saves immediately.
 */
export function VoteBoard({
  initial,
  initialTops,
  firstVisit,
  newCandy,
}: {
  initial: Record<string, Choice>;
  initialTops: string[];
  firstVisit: boolean;
  /** Recently released lines and what players have voted on them so far. */
  newCandy?: { ids: string[]; votes: Record<string, LineVotes>; voters: number };
}) {
  const [choices, setChoices] = useState(initial);
  const [tops, setTops] = useState(() => new Set(initialTops));
  const [error, setError] = useState<string | null>(null);
  /** Line the player tried to star while their Top 3 was full; opens the swap prompt. */
  const [swapFor, setSwapFor] = useState<string | null>(null);
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LINES.filter((line) => {
      if (filter !== "all" && (choices[line.id] ?? "undecided") !== filter) return false;
      return !q || line.members.some((member) => member.name.toLowerCase().includes(q));
    });
  }, [choices, query, filter]);

  const counts = { want: 0, dont_want: 0, undecided: 0 };
  for (const line of LINES) counts[choices[line.id] ?? "undecided"]++;

  /** Applies a change locally, saves it, and rolls both maps back if the save fails. */
  async function save(lineId: string, next: { choice: Choice; top: boolean }, request: () => Promise<{ error?: string }>) {
    const previous = { choice: choices[lineId], top: tops.has(lineId) };
    const apply = (choice: Choice | undefined, top: boolean) => {
      setChoices((current) => {
        const out = { ...current };
        if (choice) out[lineId] = choice;
        else delete out[lineId];
        return out;
      });
      setTops((current) => {
        const out = new Set(current);
        if (top) out.add(lineId);
        else out.delete(lineId);
        return out;
      });
    };
    setError(null);
    apply(next.choice, next.top);
    let failure: string | undefined;
    try {
      failure = (await request()).error;
    } catch (e) {
      rethrowIfNavigation(e);
      failure = SAVE_FAILED;
    }
    if (failure) {
      setError(failure);
      apply(previous.choice, previous.top);
    }
  }

  function choose(lineId: string, choice: Choice) {
    // Anything but Want drops the star (the database does the same).
    save(lineId, { choice, top: choice === "want" && tops.has(lineId) }, () => setChoice(lineId, choice));
  }

  function toggleTop(lineId: string) {
    if (tops.has(lineId)) {
      save(lineId, { choice: choices[lineId] ?? "want", top: false }, () => setTop(lineId, false));
      return;
    }
    if (tops.size >= MAX_TOP) {
      setSwapFor(lineId);
      return;
    }
    save(lineId, { choice: "want", top: true }, () => setTop(lineId, true));
  }

  /** Swap prompt: drop `outId` from the Top 3 and star `swapFor` instead. */
  async function swap(outId: string) {
    const inId = swapFor;
    if (!inId) return;
    setSwapFor(null);
    const previous = { tops, inChoice: choices[inId] };
    setError(null);
    setTops((current) => new Set([...current].filter((id) => id !== outId)).add(inId));
    setChoices((current) => ({ ...current, [inId]: "want" }));
    let failure: string | undefined;
    try {
      failure = (await swapTop(outId, inId)).error;
    } catch (e) {
      rethrowIfNavigation(e);
      failure = SAVE_FAILED;
    }
    if (failure) {
      setError(failure);
      setTops(previous.tops);
      setChoices((current) => {
        const out = { ...current };
        if (previous.inChoice) out[inId] = previous.inChoice;
        else delete out[inId];
        return out;
      });
    }
  }

  const topLines = LINES.filter((line) => tops.has(line.id));
  // null until storage is read, so a closed card never flashes on load.
  const [dismissedNew, setDismissedNew] = useState<Set<string> | null>(null);
  useEffect(() => {
    try {
      setDismissedNew(new Set(JSON.parse(localStorage.getItem(NEW_DISMISSED_KEY) ?? "[]")));
    } catch {
      setDismissedNew(new Set()); // Storage unavailable: cards show until voted on.
    }
  }, []);
  function dismissNew(lineId: string) {
    const next = new Set(dismissedNew ?? []).add(lineId);
    setDismissedNew(next);
    try {
      localStorage.setItem(NEW_DISMISSED_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered; fine.
    }
  }
  // Which new lines get a card is fixed at load (undecided, not starred), so a card stays put while you vote on it
  // and is gone next visit. Closing it hides it for good in this browser.
  const [pinnedNew] = useState(() => (newCandy?.ids ?? []).filter((id) => (initial[id] ?? "undecided") === "undecided" && !initialTops.includes(id)));
  const newCards = dismissedNew ? pinnedNew.filter((id) => !dismissedNew.has(id) && LINES_BY_ID.has(id)) : [];
  const cancelSwap = useCallback(() => setSwapFor(null), []);

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

      {firstVisit && (
        <p className="mb-4 text-center text-sm text-slate-500">
          Pick Want or Don&apos;t Want on the candies you care about. Everything else stays Undecided.
        </p>
      )}

      {newCards.map((id) => (
        <NewCandyCard
          key={id}
          line={LINES_BY_ID.get(id)!}
          votes={newCandy!.votes[id]}
          voters={newCandy!.voters}
          choice={choices[id]}
          starred={tops.has(id)}
          onChoose={(choice) => choose(id, choice)}
          onStar={() => toggleTop(id)}
          onDismiss={() => dismissNew(id)}
        />
      ))}

      <section className="card mb-4 p-3" aria-label="Your Top 3">
        <h2 className="font-bold">Your Top {MAX_TOP}</h2>
        <p className="mb-2 text-xs text-slate-500">Tap ★ on a candy to star it as a top want. These count double in matching and on the tier list.</p>
        <ul className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_TOP }, (_, i) => {
            const line = topLines[i];
            return line ? (
              <li key={line.id} className="relative flex flex-col items-center rounded-2xl bg-white p-2 dark:bg-night-deep">
                <StarButton starred name={line.name} onClick={() => toggleTop(line.id)} className="absolute -right-1 -top-1 scale-75" />
                <img src={lineSpriteUrl(line)} alt="" className="h-12 w-12 rounded-full bg-sky object-contain dark:bg-night" />
                <span className="mt-1 truncate text-center text-xs font-semibold">{line.name}</span>
              </li>
            ) : (
              <li
                key={`empty-${i}`}
                className="flex min-h-[5.5rem] items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-2xl text-slate-300 dark:border-slate-600 dark:text-slate-600"
              >
                ★
              </li>
            );
          })}
        </ul>
      </section>

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
        <PickFlow lines={visible} choices={choices} onChoose={choose} tops={tops} onStar={toggleTop} />
      ) : (
        <CollectionGrid lines={visible} choices={choices} onChoose={choose} tops={tops} onStar={toggleTop} />
      )}

      {swapFor && LINES_BY_ID.has(swapFor) && (
        <SwapTopDialog incoming={LINES_BY_ID.get(swapFor)!} tops={topLines} onSwap={swap} onCancel={cancelSwap} />
      )}

      <div className="mx-auto mt-10 max-w-md text-center">
        <Link href="/matches" className="btn-primary block w-full px-6 py-4 text-lg">
          Matchmake
        </Link>
      </div>
    </div>
  );
}
