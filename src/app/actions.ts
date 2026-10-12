"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeFriendCode } from "@/lib/format";
import { NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { isChoice, LINES_BY_ID, MAX_TOP } from "@/lib/lines";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function signInWithDiscord(form?: FormData) {
  const next = safeNextPath(form?.get("next"));
  if (next) (await cookies()).set(NEXT_COOKIE, next, { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect(`/?error=${encodeURIComponent(error?.message ?? "Could not start Discord sign-in")}`);
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

/** Stars or unstars a line as Top 3. Starring also makes it a want. */
export async function setTop(lineId: string, top: boolean): Promise<{ error?: string }> {
  if (!LINES_BY_ID.has(lineId)) return { error: "Invalid choice" };
  const { supabase, user } = await requireUser();
  const { error } = top
    ? await supabase
        .from("preferences")
        .upsert({ user_id: user.id, line_id: lineId, choice: "want", top: true }, { onConflict: "user_id,line_id" })
    : await supabase.from("preferences").update({ top: false }).eq("user_id", user.id).eq("line_id", lineId);
  if (error?.message === "top_limit") return { error: `You can star up to ${MAX_TOP}. Unstar one first.` };
  if (error) return { error: "Couldn't save, try again" };
  return {};
}

/**
 * Replaces one Top 3 star with another: unstar `outId`, then star `inId`
 * (which also makes it a want). If the second step fails the first is undone.
 */
export async function swapTop(outId: string, inId: string): Promise<{ error?: string }> {
  if (!LINES_BY_ID.has(outId) || !LINES_BY_ID.has(inId)) return { error: "Invalid choice" };
  const unstar = await setTop(outId, false);
  if (unstar.error) return unstar;
  const star = await setTop(inId, true);
  if (star.error) await setTop(outId, true);
  return star;
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

// Plain insert: players can insert and delete blocks but not update them, so an
// upsert (INSERT ... ON CONFLICT DO UPDATE) is refused. A duplicate means "already blocked".
export async function blockUser(userId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (userId === user.id) return { error: "You can't block yourself." };
  const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: userId });
  if (error && error.code !== "23505") return { error: "Couldn't block, try again" };
  revalidatePath("/", "layout");
  return {};
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
  revalidatePath("/tiers");
  return {};
}

/**
 * Removes a friend. `inactive` records that they stopped playing, which keeps
 * them out of your Find New and, once enough people say so, everyone's (until
 * they come back). A failed report doesn't undo the removal.
 */
export async function removeFriend(friendId: string, inactive = false): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("friends").delete().eq("user_id", user.id).eq("friend_id", friendId);
  if (error) return { error: "Couldn't remove friend, try again" };
  if (inactive) await supabase.rpc("report_inactive", { player: friendId });
  revalidatePath("/friends");
  revalidatePath("/tiers");
  return {};
}

export async function unblockUser(userId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  if (error) return { error: "Couldn't unblock, try again" };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteAccount() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/profile?error=delete");
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
