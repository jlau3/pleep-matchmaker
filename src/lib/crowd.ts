import type { Choice } from "./lines";
import type { LineVotes } from "./tiers";

/** Fewer active voters than this and My Votes offers no crowd hints: the crowd is too small to mean much. */
export const CROWD_MIN_VOTERS = 10;
/** A side needs at least this share of all voters... */
export const CROWD_MIN_SHARE = 0.4;
/** ...and to outnumber the other side this many times over. Anything else is divisive or low-interest: Neutral. */
export const CROWD_MARGIN = 2;

/**
 * What the crowd thinks of one line. Want when at least CROWD_MIN_SHARE of
 * voters want it and wants outnumber don't-wants CROWD_MARGIN to 1; Don't
 * Want the same way round; Neutral otherwise (the room is split, or few care).
 */
export function crowdChoice(votes: LineVotes | undefined, voters: number): Choice {
  if (!votes || voters <= 0) return "undecided";
  const { wants, dontWants } = votes;
  if (wants >= CROWD_MIN_SHARE * voters && wants >= CROWD_MARGIN * dontWants) return "want";
  if (dontWants >= CROWD_MIN_SHARE * voters && dontWants >= CROWD_MARGIN * wants) return "dont_want";
  return "undecided";
}

/** What My Votes shows under a line with "Show what others pick" on. */
export interface CrowdHint {
  /** The side the crowd leans to (crowdChoice); Neutral means split or low interest, so no glow. */
  lean: Choice;
  /** Share of active voters who want it / don't want it, 0 to 100. */
  wantPct: number;
  dontPct: number;
}

export function crowdHint(votes: LineVotes | undefined, voters: number): CrowdHint {
  const pct = (n: number) => (voters > 0 ? Math.round((100 * n) / voters) : 0);
  return { lean: crowdChoice(votes, voters), wantPct: pct(votes?.wants ?? 0), dontPct: pct(votes?.dontWants ?? 0) };
}
