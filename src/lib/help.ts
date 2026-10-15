/**
 * Version of the How it works popup. It opens by itself for anyone whose
 * profiles.help_seen_version is lower, so bump this when the help changes in
 * a way every player should see (it then shows once more to everyone).
 */
export const HELP_VERSION = 1;

/**
 * Set once the signed-in player has seen this HELP_VERSION, so pages skip the
 * profile lookup. Holds "<version>:<user id>", so another account signing in
 * on the same browser still gets its own first-time popup.
 */
export const HELP_COOKIE = "pm_help_seen";

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
export const SETUP_COOKIE = "pm_setup_done";

/** sessionStorage key: "Not now" on the setup checklist hides it until the browser session ends. */
export const SETUP_SNOOZE_KEY = "pm_setup_snoozed";

/** Welcome comes first; announcements wait until setup is finished or skipped. */
export function automaticPopup({ helpSeen, setupDone, metaSeen }: {
  helpSeen: boolean;
  setupDone: boolean;
  metaSeen: boolean;
}): "help" | "meta" | null {
  if (!helpSeen) return "help";
  if (setupDone && !metaSeen) return "meta";
  return null;
}
