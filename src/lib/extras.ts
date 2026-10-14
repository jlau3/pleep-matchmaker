import type { SupabaseClient } from "@supabase/supabase-js";

/** Adds each player's in-game icon and Reddit name (player_extras). Rows pass through unchanged if that fails. */
export async function withExtras<T extends { user_id: string }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<(T & { game_avatar?: string | null; reddit_username?: string | null })[]> {
  if (rows.length === 0) return rows;
  const { data, error } = await supabase.rpc("player_extras", { ids: rows.map((r) => r.user_id) });
  if (error || !data) return rows;
  const byId = new Map((data as { user_id: string; game_avatar: string | null; reddit_username: string | null }[]).map((e) => [e.user_id, e]));
  return rows.map((row) => {
    const extra = byId.get(row.user_id);
    return extra ? { ...row, game_avatar: extra.game_avatar, reddit_username: extra.reddit_username } : row;
  });
}
