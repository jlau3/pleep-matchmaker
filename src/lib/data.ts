import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Choice, isChoice, LINES } from "./lines";
import type { OwnProfile } from "./types";

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

export async function loadOwnProfile(supabase: SupabaseClient, userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, discord_username, discord_display_name, avatar_url, ign, friend_code, open_to_friends, allow_lookup, last_seen_at, prefs_updated_at")
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
