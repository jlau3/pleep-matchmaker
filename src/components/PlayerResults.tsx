"use client";

import { strongNameKey } from "@/lib/names";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addPlaceholder } from "@/app/actions";
import { normalizeFriendCode } from "@/lib/format";
import { type Relations, relationOf } from "@/lib/relations";
import type { LookupRow } from "@/lib/types";
import { FitPair } from "./FitPair";
import { PlayerHeader } from "./PlayerHeader";
import { PlayerLists } from "./PlayerLists";

/**
 * Search results: player cards, a "that's you" note, or, when no one turns
 * up, an offer to keep the name under Not here yet while you find or invite them.
 */
export function PlayerResults({
  q,
  rows,
  relations,
  viewerId,
  suggestPlaceholder = true,
  placeholder,
}: {
  q: string;
  rows: LookupRow[];
  relations: Relations;
  viewerId: string;
  /** Off inside Not here yet, where the name is already a placeholder. */
  suggestPlaceholder?: boolean;
  /** Searching from this Not here yet name: sending a request to (or accepting) a result clears it. */
  placeholder?: string;
}) {
  // You can't add or block yourself: say it's you instead of showing your own card.
  const foundSelf = rows.some((player) => player.user_id === viewerId);
  const players = rows.filter((player) => player.user_id !== viewerId);
  const nameGroups = new Map<string, { name: string; count: number }>();
  for (const player of rows) {
    if (!player.ign?.trim()) continue;
    const key = strongNameKey(player.ign);
    const group = nameGroups.get(key);
    nameGroups.set(key, { name: group?.name ?? player.ign, count: (group?.count ?? 0) + 1 });
  }
  return (
    <>
      {[...nameGroups.values()].filter((group) => group.count > 1).map((group) => (
        <p key={group.name} className="rounded-xl bg-sky/60 px-3 py-2 text-sm dark:bg-night-deep">
          {group.count} players named {group.name}. Match the Pokémon Sleep icon to find your friend.
        </p>
      ))}
      {foundSelf && (
        <p className="rounded-2xl bg-sky/60 p-3 text-center text-sm dark:bg-night-deep">
          That&apos;s you! Other players can find you with this search.
        </p>
      )}
      {q && !foundSelf && players.length === 0 && (
        <div className="space-y-2 py-4 text-center text-sm text-slate-500">
          <p>
            No one found. Names must match exactly, so check the spelling (capitals and spaces don&apos;t matter). Some
            players also turn search off.
          </p>
          {/* A friend code isn't a name to keep; anything else might be an IGN. */}
          {/* Keyed by name: a new search gets a fresh button instead of the last one's "Added". */}
          {suggestPlaceholder && !normalizeFriendCode(q) && <SuggestPlaceholder key={q} name={q} />}
        </div>
      )}
      {players.length > 0 && (
        <ul className="space-y-3">
          {players.map((player) => (
            <li key={player.user_id} className="card p-4">
              <PlayerHeader
                player={player}
                relation={relationOf(relations, player.user_id)}
                placeholder={placeholder}
                aside={
                  // No fit while there's nothing to compare against: no friends' votes and none of your own.
                  player.match_pct === null && player.you_fit_pct === null && player.wants.length > 0 ? (
                    <Link href="/vote" className="shrink-0 text-right text-xs font-semibold text-want underline">
                      Add friends or vote
                      <br />
                      to see how you match
                    </Link>
                  ) : (
                    <FitPair they={player.match_pct} you={player.you_fit_pct} />
                  )
                }
              />
              <PlayerLists wants={player.wants} dontWants={player.dont_wants} topWants={player.top_wants} hidden={player.votes_hidden} />
            </li>
          ))}
        </ul>
      )}
      {/* Results, but maybe not the right person: the name can still go on Not here yet. */}
      {q && players.length > 0 && suggestPlaceholder && !normalizeFriendCode(q) && (
        <div className="pt-1 text-center text-sm text-slate-500">
          <SuggestPlaceholder key={q} name={q} notFound />
        </div>
      )}
    </>
  );
}

function SuggestPlaceholder({ name, notFound = false }: { name: string; /** Results came up, just not them. */ notFound?: boolean }) {
  const [state, setState] = useState<"idle" | "saved" | string>("idle");
  const [pending, startTransition] = useTransition();
  if (state === "saved")
    return (
      <p className="font-semibold text-want">
        ✓ Added to <Link href="/friends#not-here-yet" className="underline">Friends to Find</Link>
      </p>
    );
  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-sky/60 p-3 text-slate-700 dark:bg-night-deep dark:text-slate-200">
      {notFound ? (
        <p>
          Not who you were looking for? Save <b>{name}</b> to your Friends to Find list as a reminder while you track them
          down or invite them.
        </p>
      ) : (
        <p>
          Friends with them in Pokémon Sleep? Keep <b>{name}</b> under Friends to Find as a reminder while you track them
          down or invite them.
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await addPlaceholder(name);
              setState(result.error ?? "saved");
            } catch {
              setState("Couldn't save this name. Try again.");
            }
          })
        }
        className="btn-primary mt-2 px-4 py-1.5 text-sm disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add to Friends to Find"}
      </button>
      {state !== "idle" && (
        <p role="alert" className="mt-1 text-xs text-dont">
          {state}
        </p>
      )}
    </div>
  );
}
