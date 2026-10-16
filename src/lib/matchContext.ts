/** player_extras' codes for which votes a score uses (shown as matchSourceLabel). */
export type MatchSource = "Everyone estimate" | "Friends + Everyone" | "Friends";

const SOURCE_LABEL: Record<MatchSource, string> = {
  "Everyone estimate": "global votes",
  "Friends + Everyone": "friends' and global votes",
  Friends: "friends' votes",
};
/** Tooltip suffix; scores look the same whatever their source. */
export const matchSourceLabel = (source?: MatchSource) => (source && SOURCE_LABEL[source] ? ` (from ${SOURCE_LABEL[source]})` : "");

/** Each direction uses a different player's friend list and votes. */
export interface MatchContext {
  you_source?: MatchSource;
  they_source?: MatchSource;
  you_voted?: boolean | null;
  they_voted?: boolean | null;
}

export function missingMatchReason(direction: "you" | "them", voted?: boolean | null): string {
  const label = direction === "you" ? "For you" : "For them";
  if (voted === false) return `${label}: ${direction === "you" ? "vote on candy" : "they need to vote on candy"} to calculate this score`;
  return `${label}: not enough voting data`;
}
