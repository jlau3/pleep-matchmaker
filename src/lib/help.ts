/**
 * Legacy onboarding marker, now recorded when guided Profile setup starts.
 * Sign-in routing still uses it to distinguish new and returning players.
 */
export const HELP_VERSION = 2;

/** Legacy account/version cookie retained alongside the onboarding marker. */
export const HELP_COOKIE = "pm_help_seen";

/**
 * Page guides cancel these navbar events when they open. Without a mounted
 * guide (for example while loading), the button links to Guides.
 */
export const TIER_TOUR_EVENT = "pm:tier-tour";
export const TIER_TOUR_COMPLETE_EVENT = "pm:tier-tour-complete";
export const MATCH_HELP_EVENT = "pm:match-help";
export const VOTE_HELP_EVENT = "pm:vote-help";
export const PROFILE_HELP_EVENT = "pm-profile-guide-open";

export function pageHelp(pathname: string): { title: string; event?: string } {
  switch (pathname) {
    case "/":
    case "/tiers": return { title: "Replay Tier List Walkthrough", event: TIER_TOUR_EVENT };
    case "/friends":
    case "/matches": return { title: "How Match Scores Work", event: MATCH_HELP_EVENT };
    case "/vote": return { title: "How to Vote", event: VOTE_HELP_EVENT };
    case "/profile": return { title: "Replay Profile Walkthrough", event: PROFILE_HELP_EVENT };
    default: return { title: "Guides" };
  }
}

export const helpCookieValue = (userId: string) => `${HELP_VERSION}:${userId}`;

/**
 * Set (to the user id) once the player has seen the first-friend note, so
 * pages skip its lookup (FirstFriendBanner).
 */
export const FIRST_FRIEND_COOKIE = "pm_first_friend";

/**
 * Set (to the user id) once the player has finished or skipped the setup
 * checklist, so pages skip its lookup (SetupChecklist).
 */
export const SETUP_COOKIE = "pm_setup_done_v2";

/** sessionStorage key: "Not now" on the setup checklist hides it until the browser session ends. */
export const SETUP_SNOOZE_KEY = "pm_setup_snoozed_v2";

/** Announcements wait until setup is finished or skipped; no welcome popup. */
export function automaticPopup({ setupDone, metaSeen }: {
  setupDone: boolean;
  metaSeen: boolean;
}): "meta" | null {
  if (setupDone && !metaSeen) return "meta";
  return null;
}
