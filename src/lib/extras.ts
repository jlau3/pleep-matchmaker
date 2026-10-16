import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchContext } from "./matchContext";

type Extras = MatchContext & {
  user_id: string;
  game_avatar?: string | null;
  reddit_username?: string | null;
  votes_hidden?: boolean;
};

/** Shared identity/privacy and directional match context, in the RPC's 200-player batches. */
export async function withExtras<T extends { user_id: string }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<(T & Omit<Extras, "user_id">)[]> {
  if (rows.length === 0) return rows;
  const batches = [];
  for (let i = 0; i < rows.length; i += 200) {
    batches.push(supabase.rpc("player_extras", { ids: rows.slice(i, i + 200).map((r) => r.user_id) }));
  }
  const results = await Promise.all(batches);
  const byId = new Map(results.flatMap(({ data, error }) => error ? [] : (data ?? []) as Extras[]).map((e) => [e.user_id, e]));
  return rows.map((row) => {
    const extra = byId.get(row.user_id);
    if (!extra) return row;
    const { user_id: _id, ...context } = extra;
    return { ...row, ...context };
  });
}
