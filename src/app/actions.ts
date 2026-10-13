"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeFriendCode } from "@/lib/format";
import { META_COOKIE, META_POSTS, metaCookieValue } from "@/content/meta";
import { loadCommunityStats } from "@/lib/communityStats";
import { CROWD_MIN_VOTERS, crowdVotes } from "@/lib/crowd";
import { loadOwnVotes } from "@/lib/data";
import { HELP_COOKIE, HELP_VERSION, helpCookieValue } from "@/lib/help";
import { NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { isChoice, LINES_BY_ID, MAX_TOP } from "@/lib/lines";
import { createClient, requireUser } from "@/lib/supabase/server";

const OAUTH_PROVIDERS = { discord: "Discord", google: "Google" } as const;

/** Remembers where the player was headed (a shared /friends?q= link, say) for after sign-in. */
async function rememberNext(form?: FormData) {
  const next = safeNextPath(form?.get("next"));
  if (next) (await cookies()).set(NEXT_COOKIE, next, { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

/** Discord or Google sign-in; the form's `provider` field picks which. */
export async function signInWithOAuth(form?: FormData) {
  const provider = String(form?.get("provider") ?? "discord");
  if (!(provider in OAUTH_PROVIDERS)) redirect("/?error=Unknown+sign-in+option");
  const label = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
  await rememberNext(form);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as keyof typeof OAUTH_PROVIDERS,
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect(`/?error=${encodeURIComponent(error?.message ?? `Could not start ${label} sign-in`)}`);
  redirect(data.url);
}

export interface MagicLinkState {
  sentTo?: string;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Emails a one-time sign-in link (no password). The link opens /auth/confirm,
 * which works even when it's opened in a different browser than this one
 * (e.g. the mail app's), see the README for the email template it needs.
 */
export async function sendMagicLink(_prev: MagicLinkState, form: FormData): Promise<MagicLinkState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "That doesn't look like an email address." };
  await rememberNext(form);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) {
    return {
      error: /rate|limit|seconds/i.test(error.message)
        ? "Too many sign-in emails just now. Wait a minute and try again."
        : "Couldn't send the email. Try again in a bit.",
    };
  }
  return { sentTo: email };
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

/**
 * "Copy everyone's votes": sets every line to what the active players lean
 * towards (see crowdChoice). Lines the player starred keep their vote and
 * star; those are personal picks.
 */
export async function adoptCrowdVotes(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const [community, own] = await Promise.all([loadCommunityStats(supabase), loadOwnVotes(supabase, user.id)]);
  if (community.voters < CROWD_MIN_VOTERS) return { error: "Not enough players have voted yet. Try again later." };
  const { choices } = crowdVotes(community.votes, community.voters);
  const starred = new Set(own.tops);
  const rows = Object.entries(choices)
    .filter(([lineId]) => !starred.has(lineId))
    .map(([lineId, choice]) => ({ user_id: user.id, line_id: lineId, choice }));
  const { error } = await supabase.from("preferences").upsert(rows, { onConflict: "user_id,line_id" });
  if (error) return { error: "Couldn't save, try again" };
  revalidatePath("/", "layout");
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

  const update: Record<string, unknown> = {
    ign: ign || null,
    friend_code: friendCode,
    open_to_friends: form.get("open_to_friends") === "on",
    allow_lookup: form.get("allow_lookup") === "on",
  };
  // Only Discord accounts get the checkbox (an unchecked box isn't submitted, hence the marker).
  if (form.has("has_show_discord")) update.show_discord = form.get("show_discord") === "on";
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
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
  // Whole layout: the "added you" banner may need to go.
  revalidatePath("/", "layout");
  return {};
}

/** "Not now" on someone who added you: stops prompting about them (they stay addable by search). */
export async function dismissAddedYou(adderId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("friend_prompt_dismissals").insert({ user_id: user.id, adder_id: adderId });
  if (error && error.code !== "23505") return { error: "Couldn't update, try again" };
  revalidatePath("/", "layout");
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

/** Records that the player has seen this HELP_VERSION of the How it works popup. */
export async function markHelpSeen(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ help_seen_version: HELP_VERSION }).eq("id", user.id);
  if (!error) (await cookies()).set(HELP_COOKIE, helpCookieValue(user.id), { path: "/", maxAge: 31536000, sameSite: "lax" });
}

/** Records that the player closed the new-Pokémon note `postId` (see src/content/meta.tsx). */
export async function markMetaSeen(postId: string): Promise<void> {
  if (!META_POSTS.some((post) => post.id === postId)) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ meta_seen_id: postId }).eq("id", user.id);
  if (!error) (await cookies()).set(META_COOKIE, metaCookieValue(postId, user.id), { path: "/", maxAge: 31536000, sameSite: "lax" });
}
