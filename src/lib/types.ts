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
  /** In-game icon ("pikachu:happy"), added by withExtras. */
  game_avatar?: string | null;
  /** Reddit handle (unverified), added by withExtras. */
  reddit_username?: string | null;
  /** Friends-only votes they keep from you: lists come back empty, match %s still count them. Added by withExtras. */
  votes_hidden?: boolean;
}

export interface MatchRow extends PlayerContact {
  /** "For them": how well their wants fit what your friends want (see the friends_fit migration). Null when unknown. */
  match_pct: number | null;
  /** Their wants that your friends want too, most-wanted first: what you'd send them that they want. */
  fit_wants: string[];
  /** Their don't-wants that your friends want, most-wanted first: what they'd rather not be sent. */
  fit_dont_wants: string[];
  /** browse_players only: "for you", your wants against their friends' wants. Null when unknown. */
  you_fit_pct?: number | null;
  /** browse_players only: your wants their friends want (what they'd send you that you want). */
  you_fit_wants?: string[];
  /** browse_players only: your don't-wants their friends want. */
  you_fit_dont_wants?: string[];
  /** browse_players only: their starred Top 3. */
  top_wants?: string[];
  /** browse_players only: how many players the current filter lists in all. */
  total_count?: number;
  /** browse_players only: their friends who've voted, 0 under 3 ("for you" is a dash then). */
  list_voters?: number;
  /** browse_players only: whether they've voted on anything ("for them" is a dash until they do). */
  voted?: boolean;
  /** browse_all only: "for them" + "for you", a dash counting 0; null when both are dashes (Best match order). */
  both_pct?: number | null;
  /** browse_all only: listed under Good matches (both fits high enough, 3+ of your wants on their list). */
  good?: boolean;
  /** browse_players only: your Top 3 line -> its tier on their Tier List; null or missing line = a dash. */
  top3_tiers?: Record<string, string> | null;
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
  id: string;
  discord_username: string | null;
  discord_display_name: string | null;
  avatar_url: string | null;
  ign: string | null;
  friend_code: string | null;
  open_to_friends: boolean;
  allow_lookup: boolean;
  /** Whether other players see (and can search) their Discord name and avatar. */
  show_discord: boolean;
  /** Wants, don't-wants and Top 3 show only to people on your friend list. */
  votes_private?: boolean;
  game_avatar?: string | null;
  reddit_username?: string | null;
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

/** A friend request to you that's still open (get_friend_requests). Their friend code always shows. */
export interface RequestRow extends PlayerContact {
  requested_at: string;
  /** Both fits, only when asked for (get_friend_requests(with_fit)); see MatchRow. */
  match_pct: number | null;
  you_fit_pct: number | null;
}

/**
 * Your request: still open, declined, or expired (unanswered past the TTL;
 * "open" from before 20261020000100_expired_requests.sql) (get_sent_requests).
 * Their code shows only if they're open to new friends.
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
