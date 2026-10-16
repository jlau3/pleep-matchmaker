import { cookies } from "next/headers";
import { SETUP_COOKIE } from "@/lib/help";
import { parseAvatar } from "@/lib/avatars";
import { normalizeFriendCode } from "@/lib/format";
import { REQUEST_TTL_DAYS } from "@/lib/relations";
import { setupSteps } from "@/lib/setup";
import { getAuth } from "@/lib/supabase/server";
import { SetupChecklistView } from "./SetupChecklistView";

/**
 * "Get set up": profile, votes, friends and Tier List, under the
 * nav on every page until the player finishes or skips it. Each step ticks
 * itself off from their real data, so it can't drift out of sync. Absent when
 * signed out, once done (the cookie skips the lookup), or if the lookup fails
 * (e.g. before 20261021000000_onboarding.sql).
 */
export async function SetupChecklist() {
  const { supabase, userId } = await getAuth();
  if (!userId) return null;
  if ((await cookies()).get(SETUP_COOKIE)?.value === userId) return null;
  const [profile, votes, friends, sent, placeholders] = await Promise.all([
    supabase.from("profiles").select("ign, friend_code, game_avatar, setup_done, friends_setup_started").eq("id", userId).maybeSingle(),
    supabase.from("preferences").select("line_id", { count: "exact", head: true }).eq("user_id", userId).neq("choice", "undecided"),
    supabase.from("friends").select("friend_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("friend_requests")
      .select("to_id", { count: "exact", head: true })
      .eq("from_id", userId)
      .eq("status", "open")
      .gt("created_at", new Date(Date.now() - REQUEST_TTL_DAYS * 86_400_000).toISOString()),
    supabase.from("friend_placeholders").select("name", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (profile.error || !profile.data || votes.error || friends.error) return null;
  const row = profile.data as { ign: string | null; friend_code: string | null; game_avatar: string | null; setup_done: boolean; friends_setup_started: boolean };
  if (row.setup_done) return <SetupChecklistView userId={userId} done steps={[]} />;
  const steps = setupSteps({
    name: Boolean(row.ign?.trim()),
    code: Boolean(row.friend_code && normalizeFriendCode(row.friend_code)),
    picture: Boolean(parseAvatar(row.game_avatar ?? "")),
    voted: Boolean(votes.count),
    friends: row.friends_setup_started || Boolean(friends.count) || Boolean(!sent.error && sent.count) || Boolean(!placeholders.error && placeholders.count),
  });
  return <SetupChecklistView userId={userId} done={false} steps={steps} />;
}
