import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { supabaseEnv } from "./supabase/env";
import type { LineVotes } from "./tiers";
import type { LineStatRow } from "./types";

/** How long the Everyone vote totals are reused before recounting. */
export const COMMUNITY_STATS_TTL_SECONDS = 300;

export interface CommunityStats {
  /** Want / don't-want / star counts per line among active players, and how many of them have seen it. */
  votes: Record<string, LineVotes>;
  /** Active players with at least one want or don't-want. */
  voters: number;
}

/**
 * Everyone's vote totals (get_line_stats + get_voter_count), shared across all
 * players and cached for COMMUNITY_STATS_TTL_SECONDS. The numbers are the same
 * for every caller, so whichever request misses the cache fills it with its own
 * session; nothing per-user is stored. The token is read outside the cached
 * function (cookies can't be touched inside unstable_cache) and handed to a
 * plain client there.
 */
export async function loadCommunityStats(supabase: SupabaseClient): Promise<CommunityStats> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return unstable_cache(
    async (): Promise<CommunityStats> => {
      const { url, key } = supabaseEnv();
      const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const [stats, count] = await Promise.all([db.rpc("get_line_stats"), db.rpc("get_voter_count")]);
      if (stats.error) throw stats.error;
      if (count.error) throw count.error;
      const votes: Record<string, LineVotes> = {};
      for (const row of stats.data as LineStatRow[]) {
        votes[row.line_id] = {
          wants: Number(row.wants),
          dontWants: Number(row.dont_wants),
          tops: Number(row.tops),
          ...(row.seen != null && { seen: Number(row.seen) }),
        };
      }
      return { votes, voters: Number(count.data) };
    },
    ["community-stats-v2"],
    { revalidate: COMMUNITY_STATS_TTL_SECONDS },
  )();
}
