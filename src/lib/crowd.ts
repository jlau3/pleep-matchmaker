import type { Choice } from "./lines";
import type { LineVotes } from "./tiers";

/**
 * Fewer active voters than this and My Votes offers no crowd hints: the crowd
 * is too small to mean much. Per line too: fewer than this have seen it, no lean.
 */
export const CROWD_MIN_VOTERS = 10;
/** A side needs at least this share of the voters who've seen the line... */
export const CROWD_MIN_SHARE = 0.4;
/** ...and to outnumber the other side this many times over. Anything else is divisive or low-interest: Neutral. */
export const CROWD_MARGIN = 2;

/**
 * Below this share of all voters having seen a line (a new one, mostly), its
 * numbers are labelled early: they're still coming in.
 */
export const CROWD_EARLY_SHARE = 0.8;

/**
 * Who a line's shares are out of: the active voters who've seen it (opened My
 * Votes since it was added, which saves it as Neutral for them), so a new
 * line isn't measured against players who haven't been asked yet. Falls back
 * to all voters when the count isn't known.
 */
export function seenBy(votes: LineVotes | undefined, voters: number): number {
  return votes?.seen ?? voters;
}

/**
 * What the crowd thinks of one line. Want when at least CROWD_MIN_SHARE of
 * the voters who've seen it want it and wants outnumber don't-wants
 * CROWD_MARGIN to 1; Don't Want the same way round; Neutral otherwise (the
 * room is split, few care, or fewer than CROWD_MIN_VOTERS have seen it).
 */
export function crowdChoice(votes: LineVotes | undefined, allVoters: number): Choice {
  const voters = seenBy(votes, allVoters);
  if (!votes || voters < CROWD_MIN_VOTERS) return "undecided";
  const { wants, dontWants } = votes;
  if (wants >= CROWD_MIN_SHARE * voters && wants >= CROWD_MARGIN * dontWants) return "want";
  if (dontWants >= CROWD_MIN_SHARE * voters && dontWants >= CROWD_MARGIN * wants) return "dont_want";
  return "undecided";
}

/** What My Votes shows under a line with "Show what others pick" on. */
export interface CrowdHint {
  /** The side the crowd leans to (crowdChoice); Neutral means split or low interest, so no glow. */
  lean: Choice;
  /** Share of the active voters who've seen it who want it / don't want it, 0 to 100. */
  wantPct: number;
  dontPct: number;
  /** How many active voters have seen it. */
  seen: number;
  /** Most voters haven't seen it yet (a new line): votes are still coming in. */
  early: boolean;
}

export function crowdHint(votes: LineVotes | undefined, allVoters: number): CrowdHint {
  const voters = seenBy(votes, allVoters);
  const pct = (n: number) => (voters > 0 ? Math.round((100 * n) / voters) : 0);
  return {
    lean: crowdChoice(votes, allVoters),
    wantPct: pct(votes?.wants ?? 0),
    dontPct: pct(votes?.dontWants ?? 0),
    seen: voters,
    early: voters < CROWD_EARLY_SHARE * allVoters,
  };
}
