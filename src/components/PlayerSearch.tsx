import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Relations } from "@/lib/relations";
import type { LookupRow } from "@/lib/types";
import { PlayerSearchBox } from "./PlayerSearchBox";
import { withExtras } from "@/lib/extras";

/** Reads and trims the ?q= search on the Friends tabs. */
export async function searchQuery(searchParams: Promise<{ q?: string }>): Promise<string> {
  return ((await searchParams).q ?? "").trim().slice(0, 64);
}

/**
 * Player search (exact or close names, friend codes), shared by My Friends and Find New.
 * A ?q= in the link (shared friend posts, SubTabs) is searched on the server so it shows on
 * first paint; later searches run in the box without reloading the page.
 */
export async function PlayerSearch({
  supabase,
  q,
  relations,
  viewerId,
}: {
  supabase: SupabaseClient;
  q: string;
  relations: Relations;
  viewerId: string;
}) {
  // No IGN and friend code, no search (the database returns nothing either): point at Profile instead.
  if (relations.canSearch === false)
    return (
      <div className="card p-4 text-center text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          To search for players, first{" "}
          <Link href="/profile" className="font-semibold underline">
            add your in-game name and friend code
          </Link>
          , so the people you find know who you are.
        </p>
      </div>
    );
  let rows: LookupRow[] = [];
  if (q) {
    const { data, error } = await supabase.rpc("lookup_players", { q });
    if (error) throw error;
    rows = await withExtras(supabase, data as LookupRow[]);
  }
  return <PlayerSearchBox initialQ={q} initialRows={rows} relations={relations} viewerId={viewerId} />;
}
