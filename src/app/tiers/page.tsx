import Link from "next/link";
import { TierExplorer, type PoolVotes } from "@/components/TierExplorer";
import { LINES, isSleepType } from "@/lib/lines";
import { countOwnVotes } from "@/lib/data";
import { getAuth } from "@/lib/supabase/server";
import { loadDevTierSnapshot } from "@/lib/devTierSnapshot";
import { loadPublicCommunityStats } from "@/lib/communityStats";
import { parseTierStyle } from "@/lib/tiers";
import { friendTierPool } from "@/lib/friendTierPool";
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
  const snapshot = await loadDevTierSnapshot();

  // All three lookups at once: the page waits on the slowest only. Everyone's
  // totals come from a shared 5-minute cache, so they rarely cost a round trip.
  const [votedCount, friends, everyone] = await Promise.all([
    userId ? countOwnVotes(supabase, userId) : Promise.resolve(LINES.length),
    // Votes only: skip the per-friend fit %, which only My Friends shows.
    userId ? Promise.all([supabase.rpc("get_friends", { with_match: false }), supabase.rpc("get_friend_voters")])
      .then(([contacts, voting]): PoolVotes => {
        if (contacts.error) throw contacts.error;
        if (voting.error) throw voting.error;
        return friendTierPool(contacts.data as FriendRow[], (voting.data ?? []).map((row: { user_id: string }) => row.user_id));
      }) : Promise.resolve({ votes: {}, voters: 0, friendCount: 0 }),
    snapshot ? Promise.resolve({ votes: snapshot.votes, voters: snapshot.voters, friendCount: 0, thresholded: true }) : loadPublicCommunityStats().then(
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
      everyoneSnapshot={snapshot ? { exportedAt: snapshot.exportedAt, candies: snapshot.candies } : undefined}
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
