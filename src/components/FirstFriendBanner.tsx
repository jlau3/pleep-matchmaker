import { cookies } from "next/headers";
import { FIRST_FRIEND_COOKIE } from "@/lib/help";
import { getAuth } from "@/lib/supabase/server";
import { FirstFriendBannerView } from "./FirstFriendBannerView";

/**
 * "You have your first friend!": once, on the first page a player opens after
 * their first friendship (they may have accepted, or been accepted while away).
 * Points them at the Tier List's My Friends view. Absent when signed out, once
 * noted (the cookie skips the lookup), or if the lookup fails (e.g. before
 * 20261020000400_first_friend_note.sql).
 */
export async function FirstFriendBanner() {
  const { supabase, userId } = await getAuth();
  if (!userId) return null;
  if ((await cookies()).get(FIRST_FRIEND_COOKIE)?.value === userId) return null;
  const [profile, friends] = await Promise.all([
    supabase.from("profiles").select("first_friend_noted").eq("id", userId).maybeSingle(),
    supabase.from("friends").select("friend_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (profile.error || !profile.data || friends.error) return null;
  const noted = Boolean((profile.data as { first_friend_noted: boolean }).first_friend_noted);
  if (!noted && !friends.count) return null;
  return <FirstFriendBannerView userId={userId} noted={noted} />;
}
