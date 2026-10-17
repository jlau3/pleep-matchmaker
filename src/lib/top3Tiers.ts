import type { SupabaseClient } from "@supabase/supabase-js";
import { LINES } from "./lines";

/** Per player: your starred lines → the tier each has on their Tier List ("S", "A", "B", "C", "Avoid"). */
export type Top3Tiers = Record<string, Record<string, string>>;

/**
 * Your Top 3's tiers on these players' Tier Lists, loaded in bounded batches.
 * A player missing from the result has no list yet (none of their friends has voted). Empty if that lookup isn't deployed yet.
 */
export async function loadTop3Tiers(supabase: SupabaseClient, ids: string[], strict = false): Promise<Top3Tiers> {
  if (ids.length === 0) return {};
  const out: Top3Tiers = {};
  const unique = [...new Set(ids)];
  // Three Spotlight rows per player: 200 IDs stays below PostgREST's 1,000-row
  // response limit. Do not slice away later players or mark failed batches known.
  for (let offset = 0; offset < unique.length; offset += 200) {
    const { data, error } = await supabase.rpc("top3_tiers", { players: unique.slice(offset, offset + 200), line_count: LINES.length });
    if (error && strict) throw error;
    if (error || !data) return {};
    for (const row of data as { user_id: string; line_id: string; tier: string }[]) (out[row.user_id] ??= {})[row.line_id] = row.tier;
  }
  return out;
}
