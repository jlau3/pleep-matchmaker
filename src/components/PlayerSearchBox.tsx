"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupPlayers } from "@/app/actions";
import { rethrowIfNavigation } from "@/lib/saveError";
import type { Relations } from "@/lib/relations";
import type { LookupRow } from "@/lib/types";
import { PlayerResults } from "./PlayerResults";

/**
 * The search box. Searching runs in place (a server action), so the friends
 * list below doesn't reload. Searches stay out of the URL, so a refresh starts
 * clean; a link that arrives with ?q= (a shared friend post) is searched once
 * and then dropped from the address bar.
 */
export function PlayerSearchBox({
  initialQ,
  initialRows,
  relations,
  viewerId,
}: {
  initialQ: string;
  initialRows: LookupRow[];
  relations: Relations;
  viewerId: string;
}) {
  const [input, setInput] = useState(initialQ);
  const [result, setResult] = useState({ q: initialQ, rows: initialRows });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Arrived with ?q=: it's already searched (initialRows), so drop it and a refresh starts empty.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("q")) return;
    url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim().slice(0, 64);
    setError(null);
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
        <PlayerResults q={result.q} rows={result.rows} relations={relations} viewerId={viewerId} />
      </div>
    </div>
  );
}
