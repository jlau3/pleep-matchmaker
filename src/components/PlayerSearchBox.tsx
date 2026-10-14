"use client";

import { useState, useTransition } from "react";
import { lookupPlayers } from "@/app/actions";
import { rethrowIfNavigation } from "@/lib/saveError";
import type { LookupRow } from "@/lib/types";
import { PlayerResults } from "./PlayerResults";

/**
 * The search box. Searching runs in place (a server action), so the friends
 * list below doesn't reload; the query still goes in the URL (replaceState)
 * so a reload or shared link shows the same search.
 */
export function PlayerSearchBox({
  initialQ,
  initialRows,
  friendIds,
  viewerId,
}: {
  initialQ: string;
  initialRows: LookupRow[];
  friendIds: string[];
  viewerId: string;
}) {
  const [input, setInput] = useState(initialQ);
  const [result, setResult] = useState({ q: initialQ, rows: initialRows });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 64);
    setError(null);
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
    if (!q) return setResult({ q: "", rows: [] });
    startTransition(async () => {
      try {
        const found = await lookupPlayers(q);
        if (found.error) setError(found.error);
        else setResult({ q, rows: found.rows ?? [] });
      } catch (err) {
        rethrowIfNavigation(err);
        setError("Search failed, try again");
      }
    });
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={search}>
        <input
          name="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Discord name, IGN or friend code"
          className="min-w-0 flex-1 field"
        />
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2 disabled:opacity-60">
          {pending ? "Searching…" : "Search"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-center text-sm text-dont">
          {error}
        </p>
      )}
      <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
        <PlayerResults q={result.q} rows={result.rows} friendIds={friendIds} viewerId={viewerId} />
      </div>
    </div>
  );
}
