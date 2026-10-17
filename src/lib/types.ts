import type { MatchContext } from "./matchContext";

// Row shapes returned by the Postgres functions in supabase/migrations.

export interface PlayerContact extends MatchContext {
  user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  avatar_url: string | null;
  ign: string | null;
  friend_code: string | null;
  last_seen_at: string;
  prefs_updated_at: string | null;
  /** In-game icon ("pikachu:happy"), added by withExtras. */
  game_avatar?: string | null;
  /** Reddit handle (unverified), added by withExtras. */
  reddit_username?: string | null;
  /** Private vote lists stay hidden; Mutual fit eligibility may still use internal fit. Added by withExtras. */
  votes_hidden?: boolean;
}

/** Suggestions deliberately have no other-player score or shares. */
export interface MatchRow extends PlayerContact {
  you_fit_pct: number | null;
  you_unwanted_pct: number | null;
  you_utility: number | null;
  list_voters: number;
  good: boolean;
  total_count?: number;
  top_wants?: string[];
}

export interface LookupRow extends PlayerContact {
  wants: string[];
  dont_wants: string[];
  /** Starred subset of wants (Top 3). */
  top_wants: string[];
  /** "For them": how well their wants fit your friends' wants. Null for yourself or with nothing to compare yet. */
  match_pct: number | null;
  /** "For you": how much of what you want their friends want. Null for yourself or when unknown. */
  you_fit_pct: number | null;
}

export interface LineStatRow {
  line_id: string;
  wants: number;
  dont_wants: number;
  tops: number;
  /** Active voters with any vote on it, Neutral included (20261020000200_line_seen.sql); missing before. */
  seen?: number;
}

export interface BlockedRow {
  user_id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  /** So hidden-Discord and Google/email players still have a name here. */
  ign: string | null;
  blocked_at: string;
}

export interface OwnProfile {
  match_guide_seen?: boolean;
  id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  avatar_url: string | null;
  ign: string | null;
  friend_code: string | null;
  open_to_friends: boolean;
  allow_lookup: boolean;
  /** Whether their friends see (and can search) their Discord name and avatar. Other players never do. */
  show_discord: boolean;
  /** Wants, don't-wants and Top 3 show only to people on your friend list. */
  votes_private?: boolean;
  game_avatar?: string | null;
  reddit_username?: string | null;
  /** Friends see their Reddit name. Other players never do. */
  show_reddit?: boolean;
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
  /** "For them": how well their wants fit the rest of your friends' wants. Null when hidden or nothing to compare. */
  match_pct: number | null;
  /** "For you": how much of what you want their friends want. Null when hidden or unknown. */
  you_fit_pct?: number | null;
  /** They have you on their list too (always, now that friendships are mutual). */
  added_me: boolean;
}

/** A friend request to you that's still open (get_friend_requests). It carries their friend code. */
export interface RequestRow extends PlayerContact {
  requested_at: string;
  /** Only the recipient's own fit, when asked for. */
  you_fit_pct: number | null;
}

/**
 * Your request: still open, declined, or expired (unanswered past the TTL;
 * "open" from before 20261020000100_expired_requests.sql) (get_sent_requests).
 * Their code never shows: codes travel only with requests to you (20261021000900).
 */
export interface SentRequestRow extends PlayerContact {
  requested_at: string;
  status: "open" | "declined" | "expired";
}

/** An in-game friend who isn't here yet, kept by IGN (get_friend_placeholders). */
export interface PlaceholderRow {
  name: string;
  created_at: string;
  /** A player with exactly this IGN can be found here now (maybe not them: IGNs aren't unique). */
  signed_up: boolean;
  /** One of your friends has this IGN (20261020000600_keep_placeholders.sql; missing before). */
  friend?: boolean;
}
