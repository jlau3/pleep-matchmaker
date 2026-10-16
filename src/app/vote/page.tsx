import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadCommunityStats } from "@/lib/communityStats";
import { loadOwnVotes, seedUndecided } from "@/lib/data";
import { CROWD_MIN_VOTERS } from "@/lib/crowd";
import { LINES, recentLines } from "@/lib/lines";
import type { LineVotes } from "@/lib/tiers";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const [{ choices: own, tops }, guide] = await Promise.all([
    loadOwnVotes(supabase, user.id),
    supabase.from("profiles").select("vote_guide_seen").eq("id", user.id).maybeSingle(),
  ]);
  // Open the existing voting guide once; returning players can reopen it manually.
  const autoOpenGuide = !guide.error && guide.data?.vote_guide_seen === false;
  const { choices, newIds } = await seedUndecided(supabase, user.id, own);

  // Everyone's totals (a shared 5-minute cache): the new candy cards and "Show what others pick".
  const community = await loadCommunityStats(supabase);
  const recent = recentLines().map((line) => line.id);
  let newCandy: { ids: string[]; votes: Record<string, LineVotes>; voters: number } | undefined;
  if (recent.length > 0 && newIds.length < LINES.length) {
    const votes = Object.fromEntries(recent.filter((id) => community.votes[id]).map((id) => [id, community.votes[id]]));
    newCandy = { ids: recent, votes, voters: community.voters };
  }
  const crowd = community.voters >= CROWD_MIN_VOTERS ? { votes: community.votes, voters: community.voters } : undefined;
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      <VoteBoard
        userId={user.id}
        initial={choices} initialTops={tops} newCandy={newCandy}
        crowd={crowd} autoOpenGuide={autoOpenGuide} />
    </div>
  );
}
