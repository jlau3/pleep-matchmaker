import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadCommunityStats } from "@/lib/communityStats";
import { loadOwnVotes, seedUndecided } from "@/lib/data";
import { LINES, recentLines } from "@/lib/lines";
import type { LineVotes } from "@/lib/tiers";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const { choices: own, tops } = await loadOwnVotes(supabase, user.id);
  const { choices, newIds } = await seedUndecided(supabase, user.id, own);

  // Community votes for the new candy cards; only fetched while something is new.
  const recent = recentLines().map((line) => line.id);
  let newCandy: { ids: string[]; votes: Record<string, LineVotes>; voters: number } | undefined;
  if (recent.length > 0 && newIds.length < LINES.length) {
    const community = await loadCommunityStats(supabase);
    const votes = Object.fromEntries(recent.filter((id) => community.votes[id]).map((id) => [id, community.votes[id]]));
    newCandy = { ids: recent, votes, voters: community.voters };
  }
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      <VoteBoard initial={choices} initialTops={tops} firstVisit={newIds.length === LINES.length} newCandy={newCandy} />
    </div>
  );
}
