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
 * Exact-name player search with results, shared by My Friends and Find New.
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
  return (
    <div className="space-y-3">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Exact name, IGN or friend code" className="min-w-0 flex-1 field" />
        <button type="submit" className="btn-primary px-5 py-2">
          Search
        </button>
      </form>
      {q && results.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-500">
          No one found. Names have to match exactly (case doesn&apos;t matter), and some players turn lookup off.
        </p>
      )}
      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((player) => (
            <li key={player.user_id} className="card p-4">
              <PlayerHeader player={player} isFriend={friendIds.has(player.user_id)} aside={
                  // No fit while there's nothing to compare against: no friends' votes and none of your own.
                  player.match_pct === null && player.you_fit_pct === null && player.user_id !== viewerId && player.wants.length > 0 ? (
                    <Link href="/vote" className="shrink-0 text-right text-xs font-semibold text-want underline">
                      Add friends or vote
                      <br />
                      to see their fit
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
