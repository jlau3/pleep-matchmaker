import { LINES_BY_ID } from "./lines";
import type { LineVotes } from "./tiers";

export const TIER_SNAPSHOT_DEV_BRANCH = "claude/pokemon-sleep-matchmaking-esw90a";

/** A copied aggregate export is never enabled in production, even on this branch. */
export function isDevTierSnapshotEnabled(env: Record<string, string | undefined>): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview") return env.VERCEL_GIT_COMMIT_REF === TIER_SNAPSHOT_DEV_BRANCH;
  return !env.VERCEL_ENV && (env.NODE_ENV === "development" || env.NODE_ENV === "test");
}

export interface TierSnapshot {
  exportedAt: string;
  voters: number;
  candies: number;
  votes: Record<string, LineVotes>;
}

/** Validate aggregates only. Low-count rows never leave this parser as numeric totals. */
export function parseTierSnapshot(input: unknown): TierSnapshot {
  const data = input as { exportedAt?: unknown; voters?: unknown; lines?: unknown } | null;
  if (!data || typeof data.exportedAt !== "string" || !Number.isFinite(Date.parse(data.exportedAt))
    || !Number.isSafeInteger(data.voters) || Number(data.voters) < 1 || !Array.isArray(data.lines)) {
    throw new Error("Invalid Tier List snapshot metadata");
  }
  const voters = Number(data.voters), votes: Record<string, LineVotes> = {}, ids = new Set<string>();
  for (const line of data.lines) {
    if (!line || typeof line.line_id !== "string" || !LINES_BY_ID.has(line.line_id) || ids.has(line.line_id)) {
      throw new Error("Unknown or duplicate candy in Tier List snapshot");
    }
    ids.add(line.line_id);
    for (const field of ["seen", "wants", "dont_wants", "tops"]) {
      if (!Number.isSafeInteger(line[field]) || line[field] < 0) throw new Error("Invalid snapshot count");
    }
    if (line.seen > voters || line.wants + line.dont_wants > line.seen || line.tops > line.wants) {
      throw new Error("Inconsistent snapshot totals");
    }
    if (line.seen < 10) continue;
    votes[line.line_id] = { wants: line.wants, dontWants: line.dont_wants, tops: line.tops, seen: line.seen };
  }
  return { exportedAt: data.exportedAt, voters, candies: ids.size, votes };
}
