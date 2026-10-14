"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addPlaceholder, removePlaceholder, searchPlaceholders } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import type { LookupRow, PlaceholderRow } from "@/lib/types";
import { PlayerResults } from "./PlayerResults";

type Hits = { name: string; rows: LookupRow[] }[];

/**
 * Not here yet: in-game friends who haven't signed up, by IGN, so you
 * remember to check on them. Folded by default. One Search looks up every
 * name at once and lists only the ones that turned someone up. IGNs aren't
 * unique, so a match is only a maybe: you check it's them before adding,
 * which clears the name.
 */
export function FriendPlaceholders({
  rows,
  friendIds,
  viewerId,
}: {
  rows: PlaceholderRow[];
  friendIds: string[];
  viewerId: string;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hits, setHits] = useState<{ hits: Hits; searched: number } | null>(null);
  const [searching, startSearch] = useTransition();
  const maybes = rows.filter((row) => row.signed_up).length;
  // A–Z, ignoring case and accents, so a name is easy to find in a long list.
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  const details = useRef<HTMLDetailsElement>(null);

  // Opened when linked to (#not-here-yet, e.g. from a search that found no one).
  useEffect(() => {
    if (window.location.hash === "#not-here-yet" && details.current) details.current.open = true;
  }, []);

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else onDone?.();
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  function searchAll() {
    setError(null);
    startSearch(async () => {
      try {
        const result = await searchPlaceholders();
        if (result.error) setError(result.error);
        else setHits({ hits: result.hits ?? [], searched: result.searched ?? 0 });
      } catch (e) {
        rethrowIfNavigation(e);
        setError("Search failed, try again");
      }
    });
  }

  // Names cleared since the search (added as a friend, or removed) drop out of the results.
  const shownHits = hits?.hits.filter((hit) => rows.some((row) => row.name === hit.name)) ?? [];

  return (
    <details ref={details} className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-semibold">Not here yet</span> <span className="text-sm text-slate-500">{rows.length}</span>
          {maybes > 0 && <span className="ml-2 text-xs font-semibold text-want">{maybes} may have joined</span>}
          <span className="block text-sm text-slate-500">In-game friends who haven&apos;t signed up yet.</span>
        </span>
        <span className="shrink-0 text-xs font-semibold underline group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-xs font-semibold underline group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-500">
          Add their IGN as a reminder and search now and then. Once they join, add them and they drop off this list.
        </p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addPlaceholder(name), () => setName(""));
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Their in-game name"
            aria-label="In-game name"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-night-deep"
          />
          <button type="submit" disabled={pending || !name.trim()} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="text-xs text-dont">
            {error}
          </p>
        )}
        {rows.length > 0 && (
          <>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {sorted.map((row) => (
                <li key={row.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" title={row.name}>
                      {row.name}
                    </span>
                    {row.signed_up && (
                      <span className="block text-xs text-want">Someone with this IGN joined. Search to check it&apos;s them.</span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removePlaceholder(row.name))}
                    aria-label={`Remove ${row.name}`}
                    title="Remove"
                    className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:text-slate-700 disabled:opacity-50 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={searching}
              onClick={searchAll}
              className={`w-full rounded-full py-2 text-sm font-bold disabled:opacity-60 ${
                maybes > 0 ? "bg-want text-white" : "border border-slate-300 dark:border-slate-600"
              }`}
            >
              {searching ? "Searching…" : `Search for all ${rows.length}`}
            </button>
          </>
        )}
        {hits && (
          <div className="space-y-4">
            {shownHits.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                No one found yet for {hits.searched === 1 ? "your name" : `any of your ${hits.searched} names`}. Check back later.
              </p>
            ) : (
              shownHits.map((hit) => (
                <div key={hit.name} className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Possible match{hit.rows.length === 1 ? "" : "es"} for <span className="text-want">{hit.name}</span>
                  </h4>
                  <PlayerResults q={hit.name} rows={hit.rows} friendIds={friendIds} viewerId={viewerId} suggestPlaceholder={false} placeholder={hit.name} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </details>
  );
}
