import type { SupabaseClient } from "@supabase/supabase-js";
import type { LookupRow } from "@/lib/types";
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
export async function PlayerSearch({ supabase, q, friendIds }: { supabase: SupabaseClient; q: string; friendIds: Set<string> }) {
  let results: LookupRow[] = [];
  if (q) {
    const { data, error } = await supabase.rpc("lookup_players", { q });
    if (error) throw error;
    results = data as LookupRow[];
  }
  return (
    <div className="space-y-3">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Exact Discord name, IGN or friend code" className="min-w-0 flex-1 field" />
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
              <PlayerHeader player={player} isFriend={friendIds.has(player.user_id)} />
              <PlayerLists wants={player.wants} dontWants={player.dont_wants} topWants={player.top_wants} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
