import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadOwnChoices, seedUndecided } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage() {
  const { supabase, user } = await requireUser();
  const { choices, newIds } = await seedUndecided(supabase, user.id, await loadOwnChoices(supabase, user.id));
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      <VoteBoard initial={choices} newIds={newIds} />
    </div>
  );
}
