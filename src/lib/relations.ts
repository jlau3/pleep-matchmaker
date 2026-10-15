/**
 * Where you stand with another player under the friend-request handshake
 * (20261019000000_friend_requests.sql): friends both ways, a request either
 * way (open, or one of yours they declined), or nothing yet.
 */
export type Relation = "friend" | "sent" | "declined" | "incoming" | "none";

/** Serializable, so server pages can hand it to client components. */
export interface Relations {
  friendIds: string[];
  /** Your requests by player: still open, or declined (shown until you clear it). */
  sent: Record<string, "open" | "declined">;
  /** Players whose request to you is open. */
  incoming: string[];
}

/** How long an unanswered request stays open (public.request_ttl()). */
export const REQUEST_TTL_DAYS = 30;

export const NO_RELATIONS: Relations = { friendIds: [], sent: {}, incoming: [] };

export function relationOf(relations: Relations, userId: string): Relation {
  if (relations.friendIds.includes(userId)) return "friend";
  const sent = relations.sent[userId];
  if (sent === "declined") return "declined";
  if (relations.incoming.includes(userId)) return "incoming";
  if (sent === "open") return "sent";
  return "none";
}

type RequestRow = { from_id: string; to_id: string; status: "open" | "declined"; created_at: string };

/** Sorts raw friend_requests rows (both ends are readable to you) into sent and incoming; lapsed ones drop out. */
export function sortRequests(rows: RequestRow[], userId: string, now = Date.now()): Pick<Relations, "sent" | "incoming"> {
  const fresh = (row: RequestRow) => now - Date.parse(row.created_at) < REQUEST_TTL_DAYS * 86_400_000;
  const sent: Relations["sent"] = {};
  const incoming: string[] = [];
  for (const row of rows) {
    if (row.from_id === userId && (row.status === "declined" || fresh(row))) sent[row.to_id] = row.status;
    else if (row.to_id === userId && row.status === "open" && fresh(row)) incoming.push(row.from_id);
  }
  return { sent, incoming };
}
