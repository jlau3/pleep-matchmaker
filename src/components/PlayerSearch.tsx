import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { LookupRow } from "@/lib/types";
import { FitPair } from "./FitPair";
import { PlayerHeader } from "./PlayerHeader";
import { PlayerLists } from "./PlayerLists";

/** Reads and trims the ?q= search on the Friends tabs. */
export async function searchQuery(searchParams: Promise<{ q?: string }>): Promise<string> {
  return ((await searchParams).q ?? "").trim().slice(0, 64);
}

/**
 * Player search (exact or close names, friend codes) with results, shared by My Friends and Find New.
 * The form submits to the current page, and SubTabs carries ?q= across tabs.
 */
export async function PlayerSearch({
  supabase,
  q,
  friendIds,
  viewerId,
}: {
  supabase: SupabaseClient;
  q: string;
  friendIds: Set<string>;
  viewerId: string;
}) {
  let results: LookupRow[] = [];
  if (q) {
    const { data, error } = await supabase.rpc("lookup_players", { q });
    if (error) throw error;
    results = data as LookupRow[];
  }
  // You can't add or block yourself: say it's you instead of showing your own card.
  const foundSelf = results.some((player) => player.user_id === viewerId);
  results = results.filter((player) => player.user_id !== viewerId);
  return (
    <div className="space-y-3">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Discord name, IGN or friend code" className="min-w-0 flex-1 field" />
        <button type="submit" className="btn-primary px-5 py-2">
          Search
        </button>
      </form>
      {foundSelf && (
        <p className="rounded-2xl bg-sky/60 p-3 text-center text-sm dark:bg-night-deep">
          That&apos;s you! Other players can find you with this search.
        </p>
      )}
      {q && !foundSelf && results.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">
          No one found. Try their exact name or friend code; some players turn lookup off.
        </p>
      )}
      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((player) => (
            <li key={player.user_id} className="card p-4">
              <PlayerHeader player={player} isFriend={friendIds.has(player.user_id)} aside={
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
              <PlayerLists wants={player.wants} dontWants={player.dont_wants} topWants={player.top_wants} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
