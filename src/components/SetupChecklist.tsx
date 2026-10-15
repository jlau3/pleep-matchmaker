import { cookies } from "next/headers";
import { SETUP_COOKIE } from "@/lib/help";
import { setupSteps } from "@/lib/setup";
import { getAuth } from "@/lib/supabase/server";
import { SetupChecklistView } from "./SetupChecklistView";

/**
 * "Get set up": Profile → Vote → Add friends → Tier List, as a card under the
 * nav on every page until the player finishes or skips it. Each step ticks
 * itself off from their real data, so it can't drift out of sync. Absent when
 * signed out, once done (the cookie skips the lookup), or if the lookup fails
 * (e.g. before 20261021000000_onboarding.sql).
 */
export async function SetupChecklist() {
  const { supabase, userId } = await getAuth();
  if (!userId) return null;
  if ((await cookies()).get(SETUP_COOKIE)?.value === userId) return null;
  const [profile, votes, friends, sent] = await Promise.all([
    supabase.from("profiles").select("ign, friend_code, game_avatar, setup_done").eq("id", userId).maybeSingle(),
    supabase.from("preferences").select("line_id", { count: "exact", head: true }).eq("user_id", userId).neq("choice", "undecided"),
    supabase.from("friends").select("friend_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("friend_requests").select("to_id", { count: "exact", head: true }).eq("from_id", userId).eq("status", "open"),
  ]);
  if (profile.error || !profile.data || votes.error || friends.error) return null;
  const row = profile.data as { ign: string | null; friend_code: string | null; game_avatar: string | null; setup_done: boolean };
  if (row.setup_done) return <SetupChecklistView userId={userId} done steps={[]} />;
  const steps = setupSteps({
    profile: Boolean(row.ign && row.friend_code && row.game_avatar),
    voted: Boolean(votes.count),
    friends: Boolean(friends.count) || Boolean(!sent.error && sent.count),
  });
  return <SetupChecklistView userId={userId} done={false} steps={steps} />;
}
