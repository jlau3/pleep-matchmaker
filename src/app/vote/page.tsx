import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadOwnChoices, loadOwnTops, seedUndecided } from "@/lib/data";
import { LINES } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const [own, tops] = await Promise.all([loadOwnChoices(supabase, user.id), loadOwnTops(supabase, user.id)]);
  const { choices, newIds } = await seedUndecided(supabase, user.id, own);
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      <VoteBoard initial={choices} initialTops={tops} firstVisit={newIds.length === LINES.length} />
    </div>
  );
}
