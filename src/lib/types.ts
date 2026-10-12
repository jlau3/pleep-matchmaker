// Row shapes returned by the Postgres functions in supabase/migrations.

export interface PlayerContact {
  user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  avatar_url: string | null;
  ign: string | null;
  friend_code: string | null;
  last_seen_at: string;
  prefs_updated_at: string | null;
}

export interface MatchRow extends PlayerContact {
  match_pct: number;
  shared_wants: string[];
  shared_dont_wants: string[];
}

export interface LookupRow extends PlayerContact {
  wants: string[];
  dont_wants: string[];
  /** Starred subset of wants (Top 3). */
  top_wants: string[];
}

export interface LineStatRow {
  line_id: string;
  wants: number;
  dont_wants: number;
  tops: number;
}

export interface BlockedRow {
  user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  blocked_at: string;
}

export interface OwnProfile {
  id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  avatar_url: string | null;
  ign: string | null;
  friend_code: string | null;
  open_to_friends: boolean;
  allow_lookup: boolean;
  last_seen_at: string;
  prefs_updated_at: string | null;
}

export interface FriendRow extends PlayerContact {
  added_at: string;
  /** False when the friend turned off lookup; their picks are hidden. */
  visible: boolean;
  wants: string[];
  dont_wants: string[];
  top_wants: string[];
  /** Your match % with this friend (same formula as Find New, no thresholds). Null when hidden or nothing to compare. */
  match_pct: number | null;
}
