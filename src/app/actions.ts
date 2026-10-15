"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeFriendCode } from "@/lib/format";
import { MAX_FRIENDS } from "@/lib/friendship";
import { parseAvatar } from "@/lib/avatars";
import type { LookupRow } from "@/lib/types";
import { PROFILE_INCOMPLETE, SEARCH_NEEDS_PROFILE } from "@/lib/relations";
import { nameMatch } from "@/lib/names";
import { loadTop3Tiers, type Top3Tiers } from "@/lib/top3Tiers";
import { META_COOKIE, META_POSTS, metaCookieValue } from "@/content/meta";
import { FIRST_FRIEND_COOKIE, HELP_COOKIE, HELP_VERSION, helpCookieValue, SETUP_COOKIE } from "@/lib/help";
import { LINKING_COOKIE, NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { isChoice, LINES_BY_ID, MAX_TOP } from "@/lib/lines";
import { createClient, requireUser } from "@/lib/supabase/server";
import { withExtras } from "@/lib/extras";

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

/**
 * Google sign-in from Google's own button (GoogleSignIn), so Google's popup
 * names this site instead of the Supabase project URL. `nonce` is the raw
 * value whose SHA-256 the button gave Google; Supabase checks it against the
 * token so a token can't be replayed.
 */
export async function signInWithGoogleToken(credential: string, nonce: string, next: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
  if (error) return { error: error.message };
  redirect(safeNextPath(next) ?? "/");
}

type Provider = keyof typeof OAUTH_PROVIDERS;
const isProvider = (p: string): p is Provider => p in OAUTH_PROVIDERS;

/**
 * Adds another sign-in method (Discord or Google) to the signed-in account.
 * Needs "Manual linking" turned on in Supabase Auth. Linking Discord fills in
 * the Discord name from Discord itself (see /auth/callback).
 */
export async function linkProvider(form: FormData) {
  const provider = String(form.get("provider") ?? "");
  if (!isProvider(provider)) redirect("/profile?error=link");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data?.url) redirect(`/profile?error=${encodeURIComponent(error?.message ?? "link")}`);
  (await cookies()).set(LINKING_COOKIE, provider, { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
  redirect(data.url);
}

/** Removes a sign-in method; Supabase refuses to remove the last one. */
export async function unlinkProvider(form: FormData) {
  const provider = String(form.get("provider") ?? "");
  if (!isProvider(provider)) redirect("/profile?error=link");
  const { supabase } = await requireUser();
  const { data } = await supabase.auth.getUserIdentities();
  const identity = data?.identities.find((i) => i.provider === provider);
  if (!identity || (data?.identities.length ?? 0) < 2) redirect("/profile?error=unlink-last");
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  if (provider === "discord") await supabase.rpc("sync_discord_identity");
  revalidatePath("/", "layout");
  redirect("/profile?linked=removed");
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
  // This device only: the default ("global") ends every session, e.g. your phone too.
  await supabase.auth.signOut({ scope: "local" });
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

/** Turns "Allow lookup" back on (the friend post's reminder), so a shared link finds you. */
export async function enableLookup(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ allow_lookup: true }).eq("id", user.id);
  if (error) return { error: "Couldn't turn it on, try again" };
  revalidatePath("/", "layout");
  return {};
}

/**
 * "Who can find you" -> the two settings behind it: everyone (search and Find
 * New), people who know me (search only), only my friends (neither).
 * Older forms sent the two checkboxes.
 */
function visibilityFields(form: FormData): { open_to_friends: boolean; allow_lookup: boolean } {
  const visibility = form.get("visibility");
  if (visibility === "everyone") return { open_to_friends: true, allow_lookup: true };
  if (visibility === "known") return { open_to_friends: false, allow_lookup: true };
  if (visibility === "friends") return { open_to_friends: false, allow_lookup: false };
  return { open_to_friends: form.get("open_to_friends") === "on", allow_lookup: form.get("allow_lookup") === "on" };
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
    ...visibilityFields(form),
  };
  // Only Discord accounts get the checkbox (an unchecked box isn't submitted, hence the marker).
  if (form.has("has_show_discord")) update.show_discord = form.get("show_discord") === "on";

  // Icon and Reddit name (profile_extras migration).
  const extras: Record<string, unknown> = {};
  if (form.has("has_extras")) {
    const reddit = String(form.get("reddit_username") ?? "").trim().replace(/^\/?u\//i, "");
    if (reddit && !/^[A-Za-z0-9_-]{3,20}$/.test(reddit)) return { error: "Reddit names are 3 to 20 letters, numbers, - or _" };
    const avatar = String(form.get("game_avatar") ?? "");
    if (avatar && !parseAvatar(avatar)) return { error: "Pick an icon from the list" };
    extras.reddit_username = reddit || null;
    extras.game_avatar = avatar || null;
  }
  if (form.has("has_show_reddit")) extras.show_reddit = form.get("show_reddit") === "on";
  let { error } = await supabase.from("profiles").update({ ...update, ...extras }).eq("id", user.id);
  // Before that migration runs, save the rest.
  if (error && Object.keys(extras).length > 0) ({ error } = await supabase.from("profiles").update(update).eq("id", user.id));
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
  their_list_full: "Their friend list is full (50).",
  friend_unavailable: "This player can't be added.",
  request_limit: "You have 50 requests waiting. Cancel some first.",
  profile_incomplete: PROFILE_INCOMPLETE,
  request_gone: "That request isn't open anymore.",
};

/** Clears the Not here yet name a player was found from (it may not be exactly their IGN). */
/**
 * Sends a friend request (which also means "I'll send you one in Pokémon
 * Sleep"). "friends" when they had already asked you: both of you said yes.
 */
export async function sendFriendRequest(
  targetId: string,
  /** Leave the page as is (the card is asking about a Not here yet name); the client refreshes after. */
  deferRefresh = false,
  /** Send your friend code with it; false for "We're already friends in Pokémon Sleep" (20261021001000). */
  withCode = true,
): Promise<{ status?: "sent" | "friends"; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("send_friend_request", withCode ? { target: targetId } : { target: targetId, with_code: false });
  if (error) return { error: FRIEND_ERRORS[error.message] ?? "Couldn't send the request, try again" };
  // Whole layout: the requests banner and every Add friend button may change.
  if (!deferRefresh) revalidatePath("/", "layout");
  return { status: data === "friends" ? "friends" : "sent" };
}

export async function acceptFriendRequest(requesterId: string, deferRefresh = false): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("accept_friend_request", { requester: requesterId });
  if (error) return { error: FRIEND_ERRORS[error.message] ?? "Couldn't accept, try again" };
  if (!deferRefresh) revalidatePath("/", "layout");
  return {};
}

/** Declines a request to you; the sender sees it was declined. */
export async function declineFriendRequest(requesterId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("decline_friend_request", { requester: requesterId });
  if (error) return { error: "Couldn't update, try again" };
  revalidatePath("/", "layout");
  return {};
}

/** Withdraws your request, or clears one they declined (you can ask again after). */
export async function cancelFriendRequest(targetId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_friend_request", { target: targetId });
  if (error) return { error: "Couldn't update, try again" };
  revalidatePath("/", "layout");
  return {};
}

/**
 * Removes a friend, from both lists. `inactive` records that they stopped
 * playing, which keeps them out of your Find New and, once enough people say
 * so, everyone's (until they come back). A failed report doesn't undo the removal.
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

/** Searching needs your own IGN and friend code (the database enforces it too). A failed lookup lets the search run. */
async function profileReady(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("ign, friend_code").eq("id", userId).maybeSingle();
  return Boolean(error || (data?.ign && data?.friend_code));
}

/** Player search as an action, so the search box and Not here yet can look people up without reloading the page. */
export async function lookupPlayers(q: string): Promise<{ rows?: LookupRow[]; error?: string }> {
  const { supabase, user } = await requireUser();
  const query = q.trim().slice(0, 64);
  if (!query) return { rows: [] };
  if (!(await profileReady(supabase, user.id))) return { error: SEARCH_NEEDS_PROFILE };
  const { data, error } = await supabase.rpc("lookup_players", { q: query });
  if (error) return { error: "Search failed, try again" };
  return { rows: await withExtras(supabase, data as LookupRow[]) };
}

/**
 * Not here yet's single search: looks up every saved name at once and returns the
 * names that turned someone up, in A-Z order, with only the players whose IGN is
 * that name (strongNameKey: case, spaces and symbols aside). Names with no one
 * found are left out.
 */
export async function searchPlaceholders(): Promise<{ hits?: { name: string; rows: LookupRow[] }[]; searched?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!(await profileReady(supabase, user.id))) return { error: SEARCH_NEEDS_PROFILE };
  const { data, error } = await supabase.from("friend_placeholders").select("name").eq("user_id", user.id);
  if (error) return { error: "Search failed, try again" };
  const names = (data ?? []).map((r) => r.name as string);
  const results = await Promise.all(
    names.map(async (name) => {
      const found = await supabase.rpc("lookup_players", { q: name });
      // Exact IGN only (as the "may have joined" flag): no lookalikes, friend codes or Discord names.
      const same = ((found.data ?? []) as LookupRow[]).filter((row) => row.user_id !== user.id && nameMatch(row.ign, name) === "strong");
      const rows = await withExtras(supabase, same);
      return { name, rows };
    }),
  );
  const hits = results
    .filter((r) => r.rows.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  return { hits, searched: names.length };
}

/**
 * Placeholder for an in-game friend who hasn't signed up yet, by IGN. It stays
 * until removed (20261020000600_keep_placeholders.sql).
 */
export async function addPlaceholder(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "Type their in-game name." };
  if (clean.length > 40) return { error: "That's longer than an in-game name can be." };
  const { error } = await supabase.from("friend_placeholders").insert({ user_id: user.id, name: clean });
  if (error?.code === "23505") return { error: "Already on your list." };
  if (error?.message === "placeholder_limit") return { error: `That's ${MAX_FRIENDS} already. Remove one first.` };
  if (error) return { error: "Couldn't save, try again" };
  revalidatePath("/friends");
  return {};
}

export async function removePlaceholder(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("friend_placeholders").delete().eq("user_id", user.id).eq("name", name);
  if (error) return { error: "Couldn't remove, try again" };
  revalidatePath("/friends");
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

/**
 * Records that the player finished or skipped the setup checklist (SetupChecklist).
 * Finishing it on the Tier List with a friend already covers the first-friend note.
 */
export async function markSetupDone(finished = false): Promise<void> {
  const { supabase, user } = await requireUser();
  const friends = finished
    ? (await supabase.from("friends").select("friend_id", { count: "exact", head: true }).eq("user_id", user.id)).count
    : 0;
  const { error } = await supabase
    .from("profiles")
    .update(friends ? { setup_done: true, first_friend_noted: true } : { setup_done: true })
    .eq("id", user.id);
  if (!error) (await cookies()).set(SETUP_COOKIE, user.id, { path: "/", maxAge: 31536000, sameSite: "lax" });
}

/** Records that the voting guide has opened by itself once (VoteGuide). */
export async function markVoteGuideSeen(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({ vote_guide_seen: true }).eq("id", user.id);
}

/** Your Top 3's tiers on these players' Tier Lists, for Find New's Top 3 sort (FindNewBoard). */
export async function loadTop3TiersFor(ids: string[]): Promise<Top3Tiers> {
  const { supabase } = await requireUser();
  return loadTop3Tiers(supabase, ids.filter((id) => typeof id === "string").slice(0, 1000));
}

/** Records that the player has seen the "You have your first friend!" note (FirstFriendBanner). */
export async function markFirstFriendNoted(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ first_friend_noted: true }).eq("id", user.id);
  if (!error) (await cookies()).set(FIRST_FRIEND_COOKIE, user.id, { path: "/", maxAge: 31536000, sameSite: "lax" });
}

/** Records that the player closed the new-Pokémon note `postId` (see src/content/meta.tsx). */
export async function markMetaSeen(postId: string): Promise<void> {
  if (!META_POSTS.some((post) => post.id === postId)) return;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ meta_seen_id: postId }).eq("id", user.id);
  if (!error) (await cookies()).set(META_COOKIE, metaCookieValue(postId, user.id), { path: "/", maxAge: 31536000, sameSite: "lax" });
}
