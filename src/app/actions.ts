"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeFriendCode } from "@/lib/format";
import { isChoice, LINES_BY_ID } from "@/lib/lines";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function signInWithDiscord() {
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/?error=auth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setChoice(lineId: string, choice: string): Promise<{ error?: string }> {
  if (!LINES_BY_ID.has(lineId) || !isChoice(choice)) return { error: "Invalid choice" };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("preferences")
    .upsert({ user_id: user.id, line_id: lineId, choice }, { onConflict: "user_id,line_id" });
  if (error) return { error: "Couldn't save, try again" };
  return {};
}

export interface ProfileFormState {
  error?: string;
  saved?: boolean;
}

export async function updateProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const ign = String(form.get("ign") ?? "").trim();
  const rawCode = String(form.get("friend_code") ?? "").trim();
  const friendCode = rawCode ? normalizeFriendCode(rawCode) : null;

  if (ign.length > 40) return { error: "IGN is too long (40 characters max)" };
  if (rawCode && !friendCode) return { error: "Friend code should be 12 digits" };

  const { error } = await supabase
    .from("profiles")
    .update({
      ign: ign || null,
      friend_code: friendCode,
      open_to_friends: form.get("open_to_friends") === "on",
      allow_lookup: form.get("allow_lookup") === "on",
    })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save your profile, try again" };
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function blockUser(userId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("blocks").upsert({ blocker_id: user.id, blocked_id: userId }, { onConflict: "blocker_id,blocked_id" });
  revalidatePath("/", "layout");
}

const FRIEND_ERRORS: Record<string, string> = {
  friend_limit: "You already have 50 friends. Remove someone first.",
  friend_unavailable: "This player can't be added.",
};

export async function addFriend(friendId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("friends").insert({ user_id: user.id, friend_id: friendId });
  if (error && error.code !== "23505") return { error: FRIEND_ERRORS[error.message] ?? "Couldn't add friend, try again" };
  revalidatePath("/friends");
  return {};
}

export async function removeFriend(friendId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("friends").delete().eq("user_id", user.id).eq("friend_id", friendId);
  if (error) return { error: "Couldn't remove friend, try again" };
  revalidatePath("/friends");
  return {};
}

export async function unblockUser(userId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  revalidatePath("/profile");
}

export async function deleteAccount() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/profile?error=delete");
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
