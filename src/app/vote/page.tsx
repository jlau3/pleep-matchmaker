import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { CrowdVotesCard } from "@/components/CrowdVotesCard";
import { VoteBoard } from "@/components/VoteBoard";
import { loadCommunityStats } from "@/lib/communityStats";
import Link from "next/link";
import { loadOwnProfile, loadOwnVotes, seedUndecided } from "@/lib/data";
import { CROWD_MIN_VOTERS, crowdVotes } from "@/lib/crowd";
import { LINES, recentLines } from "@/lib/lines";
import type { LineVotes } from "@/lib/tiers";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const [{ choices: own, tops }, profile] = await Promise.all([loadOwnVotes(supabase, user.id), loadOwnProfile(supabase, user.id)]);
  // Google/email players, and Discord players hiding their name, are known by IGN only.
  const needsIgn = !profile.ign && !(profile.show_discord && profile.discord_username);
  const { choices, newIds } = await seedUndecided(supabase, user.id, own);

  // Everyone's totals (a shared 5-minute cache): the new candy cards and "Copy everyone's votes".
  const community = await loadCommunityStats(supabase);
  const recent = recentLines().map((line) => line.id);
  let newCandy: { ids: string[]; votes: Record<string, LineVotes>; voters: number } | undefined;
  if (recent.length > 0 && newIds.length < LINES.length) {
    const votes = Object.fromEntries(recent.filter((id) => community.votes[id]).map((id) => [id, community.votes[id]]));
    newCandy = { ids: recent, votes, voters: community.voters };
  }
  const crowd = community.voters >= CROWD_MIN_VOTERS ? crowdVotes(community.votes, community.voters).counts : null;
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      {needsIgn && (
        <p className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Add your in-game name and friend code in{" "}
          <Link href="/profile" className="font-semibold underline">
            Settings
          </Link>{" "}
          so friends can recognize and find you.
        </p>
      )}
      {crowd && <CrowdVotesCard voters={community.voters} counts={crowd} />}
      {/* Remounts with fresh votes when they change server-side (Copy everyone's votes). */}
      <VoteBoard
        key={profile.prefs_updated_at ?? "never"}
        initial={choices} initialTops={tops} firstVisit={newIds.length === LINES.length} newCandy={newCandy} />
    </div>
  );
}
