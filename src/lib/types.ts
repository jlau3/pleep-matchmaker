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
  /** They have you on their friend list too. */
  added_me: boolean;
}

/** Someone who added you and you haven't added back or dismissed (get_added_me). */
export interface AddedMeRow extends PlayerContact {
  added_at: string;
}
