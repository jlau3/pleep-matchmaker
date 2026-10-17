import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRow } from "./types";

export const CANDIDATE_BATCH_SIZE = 500;

/** Stable ID cursor: each bounded batch scores only its own eligible players.
 * Load the complete population before client sorting/filtering; never silently
 * substitute the highest-utility 1,000 for All Players. Hidden fits stay in SQL.
 */
export async function loadCandidates(supabase: SupabaseClient): Promise<MatchRow[]> {
  const rows: MatchRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const { data, error } = await supabase.rpc("browse_candidate_batch", { after_id: cursor, batch_size: CANDIDATE_BATCH_SIZE });
    if (error) throw error;
    const batch = (data ?? []) as MatchRow[];
    if (batch.length === 0) return rows;
    const next = batch[batch.length - 1].user_id;
    if (cursor != null && next <= cursor) throw new Error("Candidate cursor did not advance");
    rows.push(...batch);
    if (batch.length < CANDIDATE_BATCH_SIZE) return rows;
    cursor = next;
  }
}
