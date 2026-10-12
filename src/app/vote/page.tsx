import { PROFILE_TABS, SubTabs } from "@/components/SubTabs";
import { VoteBoard } from "@/components/VoteBoard";
import { loadOwnChoices } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";

export default async function VotePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireUser();
  const choices = await loadOwnChoices(supabase, user.id);
  const { error } = await searchParams;
  return (
    <div>
      <SubTabs tabs={PROFILE_TABS} active="/vote" />
      {error === "finish" && (
        <p role="alert" className="mb-2 text-sm text-dont">
          Couldn&apos;t save your skipped candies. Try Matchmake again.
        </p>
      )}
      <VoteBoard initial={choices} />
    </div>
  );
}
