import { countVotes } from "./tiers";
import type { FriendRow } from "./types";

/** Saved Neutral votes are real votes; an unsaved list isn't a Neutral vote. */
export function friendTierPool(rows: Pick<FriendRow, "user_id" | "visible" | "wants" | "dont_wants" | "top_wants">[], voterIds: string[]) {
  const voters = new Set(voterIds);
  const players = rows.filter((row) => row.visible && voters.has(row.user_id));
  return { votes: Object.fromEntries(countVotes(players)), voters: players.length, friendCount: rows.length };
}
