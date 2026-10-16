import type { SupabaseClient } from "@supabase/supabase-js";
import { LINES } from "./lines";

/** Per player: your starred lines → the tier each has on their Tier List ("S", "A", "B", "C", "Avoid"). */
export type Top3Tiers = Record<string, Record<string, string>>;

/**
 * Your Top 3's tiers on these players' Tier Lists (top3_tiers; up to 1000
 * players). A player missing from the result has no list yet (none of their
 * friends has voted). Empty if that lookup isn't deployed yet.
 */
export async function loadTop3Tiers(supabase: SupabaseClient, ids: string[], strict = false): Promise<Top3Tiers> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("top3_tiers", { players: ids.slice(0, 1000), line_count: LINES.length });
  if (error && strict) throw error;
  if (error || !data) return {};
  const out: Top3Tiers = {};
  for (const row of data as { user_id: string; line_id: string; tier: string }[]) (out[row.user_id] ??= {})[row.line_id] = row.tier;
  return out;
}
