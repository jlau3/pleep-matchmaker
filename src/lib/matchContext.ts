export type MatchSource = "Everyone estimate" | "Friends + Everyone" | "Friends";

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
