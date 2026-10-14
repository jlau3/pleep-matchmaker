import type { SupabaseClient } from "@supabase/supabase-js";
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
  friendIds,
  viewerId,
}: {
  supabase: SupabaseClient;
  q: string;
  friendIds: Set<string>;
  viewerId: string;
}) {
  let rows: LookupRow[] = [];
  if (q) {
    const { data, error } = await supabase.rpc("lookup_players", { q });
    if (error) throw error;
    rows = await withExtras(supabase, data as LookupRow[]);
  }
  return <PlayerSearchBox initialQ={q} initialRows={rows} friendIds={[...friendIds]} viewerId={viewerId} />;
}
