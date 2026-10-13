/**
 * Meta notes for newly released Pokémon. While a note is active (startsAt to
 * endsAt), it's the first popup signed-in players see (once per account), and
 * it tops the Guides tab. Past notes stay on Guides under "Earlier notes".
 *
 * To add one: copy the template below to the top of META_POSTS, give it a new
 * id (never reuse one: the id is how we remember who has seen it), set the
 * dates, write the body, and run the profiles.meta_seen_id migration once if
 * you haven't (supabase/migrations/20261014000000_meta_seen.sql).
 *
 *   {
 *     id: "2026-11-darkrai",
 *     title: "Darkrai: is it worth your candy?",
 *     lineId: "darkrai",            // optional: shows the line's sprite
 *     startsAt: "2026-11-01",       // UTC dates, inclusive
 *     endsAt: "2026-11-15",
 *     body: (
 *       <>
 *         <p>First paragraph.</p>
 *         <p>Second paragraph.</p>
 *       </>
 *     ),
 *   },
 */
export interface MetaPost {
  id: string;
  title: string;
  /** Candy line id whose sprite heads the note. */
  lineId?: string;
  /** First and last day it pops up (UTC, YYYY-MM-DD, both inclusive). */
  startsAt: string;
  endsAt: string;
  body: React.ReactNode;
}

/** Newest first. */
export const META_POSTS: MetaPost[] = [];

const dayStart = (date: string) => new Date(`${date}T00:00:00Z`).getTime();
const DAY_MS = 24 * 3600 * 1000;

/** The note to pop up right now: the newest one whose dates include `now`. */
export function activeMetaPost(now = new Date(), posts = META_POSTS): MetaPost | null {
  const t = now.getTime();
  return posts.find((post) => t >= dayStart(post.startsAt) && t < dayStart(post.endsAt) + DAY_MS) ?? null;
}

/** Notes whose window has started, newest first (the Guides tab lists these). */
export function publishedMetaPosts(now = new Date(), posts = META_POSTS): MetaPost[] {
  return posts.filter((post) => now.getTime() >= dayStart(post.startsAt));
}

/**
 * Set once the signed-in player has seen the active note, so pages skip the
 * profile lookup. Holds "<note id>:<user id>".
 */
export const META_COOKIE = "pm_meta_seen";
export const metaCookieValue = (postId: string, userId: string) => `${postId}:${userId}`;
