"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addPlaceholder, lookupPlayers, removePlaceholder } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import type { LookupRow, PlaceholderRow } from "@/lib/types";
import { PlayerResults } from "./PlayerResults";

/**
 * Not here yet: in-game friends who haven't signed up, by IGN, so you
 * remember to check on them. Folded by default. Search looks a name up right
 * in its row. IGNs aren't unique, so a matching player is only a maybe: the
 * row asks you to check it's them before adding, which clears it.
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
  const maybes = rows.filter((row) => row.signed_up).length;
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

  return (
    <details ref={details} className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-semibold">Not here yet</span>{" "}
          <span className="text-sm text-slate-500">{rows.length}</span>
          {maybes > 0 && (
            <span className="ml-2 text-xs font-semibold text-want">
              {maybes} may have joined
            </span>
          )}
          <span className="block text-sm text-slate-500">In-game friends who haven&apos;t signed up yet.</span>
        </span>
        <span className="shrink-0 text-xs font-semibold underline group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-xs font-semibold underline group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-500">
          Add their IGN as a reminder and tap Search now and then. Once they join, add them and they drop off this list.
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
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {rows.map((row) => (
              <PlaceholderItem
                key={row.name}
                row={row}
                friendIds={friendIds}
                viewerId={viewerId}
                busy={pending}
                onRemove={() => run(() => removePlaceholder(row.name))}
              />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** One name, with its search results opening right under it. */
function PlaceholderItem({
  row,
  friendIds,
  viewerId,
  busy,
  onRemove,
}: {
  row: PlaceholderRow;
  friendIds: string[];
  viewerId: string;
  busy: boolean;
  onRemove: () => void;
}) {
  const [results, setResults] = useState<LookupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function toggleSearch() {
    if (results) return setResults(null);
    setError(null);
    startSearch(async () => {
      try {
        const found = await lookupPlayers(row.name);
        if (found.error) setError(found.error);
        else setResults(found.rows ?? []);
      } catch (e) {
        rethrowIfNavigation(e);
        setError("Search failed, try again");
      }
    });
  }

  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
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
          disabled={searching}
          onClick={toggleSearch}
          aria-expanded={results !== null}
          className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
            results ? "border border-slate-300 dark:border-slate-600" : row.signed_up ? "bg-want text-white" : "border border-slate-300 dark:border-slate-600"
          }`}
        >
          {searching ? "Searching…" : results ? "Close" : "Search"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove ${row.name}`}
          title="Remove"
          className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:text-slate-700 disabled:opacity-50 dark:hover:text-white"
        >
          ✕
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-dont">
          {error}
        </p>
      )}
      {results && (
        <div className="mt-3 space-y-3">
          <PlayerResults q={row.name} rows={results} friendIds={friendIds} viewerId={viewerId} suggestPlaceholder={false} placeholder={row.name} />
        </div>
      )}
    </li>
  );
}
