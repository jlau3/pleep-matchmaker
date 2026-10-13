import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Choice, isChoice, LINES } from "./lines";
import type { OwnProfile } from "./types";

export { MAX_FRIENDS } from "./friendship";

/** The caller's picks, keyed by line id. Ids no longer in the data are dropped. */
export async function loadOwnChoices(supabase: SupabaseClient, userId: string): Promise<Record<string, Choice>> {
  const { data, error } = await supabase.from("preferences").select("line_id, choice").eq("user_id", userId);
  if (error) throw error;
  const known = new Set(LINES.map((line) => line.id));
  const out: Record<string, Choice> = {};
  for (const row of data) {
    if (known.has(row.line_id) && isChoice(row.choice)) out[row.line_id] = row.choice;
  }
  return out;
}

/** The caller's picks and Top 3 stars in one query (My Votes needs both). */
export async function loadOwnVotes(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ choices: Record<string, Choice>; tops: string[] }> {
  const { data, error } = await supabase.from("preferences").select("line_id, choice, top").eq("user_id", userId);
  if (error) throw error;
  const known = new Set(LINES.map((line) => line.id));
  const choices: Record<string, Choice> = {};
  const tops: string[] = [];
  for (const row of data) {
    if (!known.has(row.line_id) || !isChoice(row.choice)) continue;
    choices[row.line_id] = row.choice;
    if (row.top) tops.push(row.line_id);
  }
  return { choices, tops };
}

/**
 * Saves every line the user has no vote on as "undecided" (shown as Neutral), so Neutral is
 * the stored default from the first visit. Returns the full vote map plus the
 * ids that were new (not seen before).
 */
export async function seedUndecided(
  supabase: SupabaseClient,
  userId: string,
  choices: Record<string, Choice>,
): Promise<{ choices: Record<string, Choice>; newIds: string[] }> {
  const newIds = LINES.filter((line) => !(line.id in choices)).map((line) => line.id);
  if (newIds.length === 0) return { choices, newIds };
  const { error } = await supabase
    .from("preferences")
    .upsert(
      newIds.map((id) => ({ user_id: userId, line_id: id, choice: "undecided" as const })),
      { onConflict: "user_id,line_id", ignoreDuplicates: true },
    );
  if (error) throw error;
  const seeded = { ...choices };
  for (const id of newIds) seeded[id] = "undecided";
  return { choices: seeded, newIds };
}

export async function loadOwnProfile(supabase: SupabaseClient, userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, discord_username, discord_display_name, avatar_url, ign, friend_code, open_to_friends, allow_lookup, show_discord, last_seen_at, prefs_updated_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as OwnProfile;
}

export async function loadFriendIds(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("friends").select("friend_id").eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((row) => row.friend_id as string));
}
