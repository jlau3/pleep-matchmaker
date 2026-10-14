"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addPlaceholder, removePlaceholder } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import type { PlaceholderRow } from "@/lib/types";

/**
 * In-game friends who haven't signed up yet, by IGN, so you remember to check
 * on them. Search looks them up. IGNs aren't unique, so a matching player
 * here is only a maybe: the row asks you to check it's them before adding,
 * which clears it.
 */
export function FriendPlaceholders({ rows }: { rows: PlaceholderRow[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    <div className="space-y-3">
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
            <li key={row.name} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold" title={row.name}>
                  {row.name}
                </span>
                {row.signed_up && (
                  <span className="block text-xs text-want">Someone with this IGN joined. Search to check it&apos;s them.</span>
                )}
              </span>
              <Link
                href={`/friends?q=${encodeURIComponent(row.name)}`}
                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${
                  row.signed_up ? "bg-want text-white" : "border border-slate-300 dark:border-slate-600"
                }`}
              >
                Search
              </Link>
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
      )}
    </div>
  );
}
