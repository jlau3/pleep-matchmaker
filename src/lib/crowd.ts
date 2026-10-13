import { type Choice, LINES } from "./lines";
import type { LineVotes } from "./tiers";

/** Fewer active voters than this and "Copy everyone's votes" stays off: the crowd is too small to mean much. */
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

/** The crowd's vote on every line, plus how many land in each bucket. */
export function crowdVotes(votes: Record<string, LineVotes>, voters: number) {
  const choices: Record<string, Choice> = {};
  const counts: Record<Choice, number> = { want: 0, dont_want: 0, undecided: 0 };
  for (const line of LINES) {
    const choice = crowdChoice(votes[line.id], voters);
    choices[line.id] = choice;
    counts[choice]++;
  }
  return { choices, counts };
}
