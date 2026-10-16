import Link from "next/link";
import { TierExplorer, type PoolVotes } from "@/components/TierExplorer";
import { LINES, isSleepType } from "@/lib/lines";
import { countOwnVotes } from "@/lib/data";
import { getAuth } from "@/lib/supabase/server";
import { loadPublicCommunityStats } from "@/lib/communityStats";
import { countVotes, parseTierStyle } from "@/lib/tiers";
import type { FriendRow } from "@/lib/types";

/**
 * Loads both pools (your friends' votes and everyone's) in one go and hands
 * them to TierExplorer, which builds every view (friends / everyone, all
 * islands or one island, any sleep type or one) in the browser. Switching views never goes back to the
 * server; the query string only picks the view shown first.
 */
export default async function TiersPage({ searchParams }: { searchParams: Promise<{ pool?: string; island?: string; sleep?: string; style?: string }> }) {
  const { supabase, userId } = await getAuth();
  const params = await searchParams;

  // All three lookups at once: the page waits on the slowest only. Everyone's
  // totals come from a shared 5-minute cache, so they rarely cost a round trip.
  const [votedCount, friends, everyone] = await Promise.all([
    userId ? countOwnVotes(supabase, userId) : Promise.resolve(LINES.length),
    // Votes only: skip the per-friend fit %, which only My Friends shows.
    userId ? supabase.rpc("get_friends", { with_match: false }).then(({ data, error }): PoolVotes => {
      if (error) throw error;
      const rows = data as FriendRow[];
      const players = rows.filter((f) => f.visible && f.wants.length + f.dont_wants.length > 0);
      return { votes: Object.fromEntries(countVotes(players)), voters: players.length, friendCount: rows.length };
    }) : Promise.resolve({ votes: {}, voters: 0, friendCount: 0 }),
    loadPublicCommunityStats().then(
      (community): PoolVotes => ({ votes: community.votes, voters: community.voters, friendCount: 0, thresholded: true }),
    ),
  ]);
  const unvoted = Math.max(0, LINES.length - votedCount);

  return (
    <TierExplorer
      signedIn={Boolean(userId)}
      viewerId={userId}
      friends={friends}
      everyone={everyone}
      initialPool={!userId || params.pool !== "friends" ? "everyone" : "friends"}
      initialStyle={parseTierStyle(params.style)}
      initialIsland={params.island ?? null}
      initialSleep={isSleepType(params.sleep) ? params.sleep : null}
      loadedAt={new Date().toISOString()}
      notice={
        unvoted > 0 && (
          <Link
            href="/vote"
            className="block rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          >
            {unvoted} new {unvoted === 1 ? "candy" : "candies"} to vote on →
          </Link>
        )
      }
    />
  );
}
