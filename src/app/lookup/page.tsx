import { IslandGroups } from "@/components/IslandGroups";
import { PlayerHeader } from "@/components/PlayerHeader";
import { loadFriendIds } from "@/lib/data";
import { linesFromIds } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import type { LookupRow } from "@/lib/types";

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, user } = await requireUser();
  const friendIds = await loadFriendIds(supabase, user.id);
  const q = ((await searchParams).q ?? "").trim().slice(0, 64);

  let results: LookupRow[] = [];
  if (q) {
    const { data, error } = await supabase.rpc("lookup_players", { q });
    if (error) throw error;
    results = data as LookupRow[];
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Look up a player</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Find a player by their exact Discord name, in-game name or friend code, then add them to your Friends list to track what they want.
      </p>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Discord name, IGN or friend code"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white dark:bg-white dark:text-slate-900">
          Search
        </button>
      </form>

      {q && results.length === 0 && (
        <p className="py-6 text-center text-slate-500">
          No one found. Names have to match exactly, and some players turn lookup off.
        </p>
      )}

      <ul className="space-y-4">
        {results.map((player) => (
          <li key={player.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <PlayerHeader player={player} isFriend={friendIds.has(player.user_id)} />
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-want">Wants ({player.wants.length})</h3>
              <IslandGroups lines={linesFromIds(player.wants)} />
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-dont">Doesn't want ({player.dont_wants.length})</summary>
              <div className="mt-2">
                <IslandGroups lines={linesFromIds(player.dont_wants)} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
