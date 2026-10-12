import { HowItWorks } from "@/components/HowItWorks";
import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadOwnChoices, loadOwnTops, seedUndecided } from "@/lib/data";
import { LINES, recentLines } from "@/lib/lines";
import type { LineVotes } from "@/lib/tiers";
import type { LineStatRow } from "@/lib/types";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const [own, tops] = await Promise.all([loadOwnChoices(supabase, user.id), loadOwnTops(supabase, user.id)]);
  const { choices, newIds } = await seedUndecided(supabase, user.id, own);

  // Community votes for the new candy cards; only fetched while something is new.
  const recent = recentLines().map((line) => line.id);
  let newCandy: { ids: string[]; votes: Record<string, LineVotes>; voters: number } | undefined;
  if (recent.length > 0 && newIds.length < LINES.length) {
    const [stats, count] = await Promise.all([supabase.rpc("get_line_stats"), supabase.rpc("get_voter_count")]);
    if (stats.error) throw stats.error;
    if (count.error) throw count.error;
    const votes: Record<string, LineVotes> = {};
    for (const row of stats.data as LineStatRow[]) {
      if (recent.includes(row.line_id)) {
        votes[row.line_id] = { wants: Number(row.wants), dontWants: Number(row.dont_wants), tops: Number(row.tops) };
      }
    }
    newCandy = { ids: recent, votes, voters: Number(count.data) };
  }
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      {newIds.length === LINES.length && (
        <details open className="card mb-4 p-4">
          <summary className="cursor-pointer text-lg font-extrabold">Welcome! Here&apos;s how it works</summary>
          <div className="mt-4">
            <HowItWorks />
          </div>
        </details>
      )}
      <VoteBoard initial={choices} initialTops={tops} firstVisit={newIds.length === LINES.length} newCandy={newCandy} />
    </div>
  );
}
