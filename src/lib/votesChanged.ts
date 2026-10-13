/**
 * Voting doesn't refresh any page (each tap stays instant), so the cached
 * Tier List, Friends and Find New Friends pages would keep showing your old
 * votes. My Votes flags a change here; VotesChangedRefresh reloads the data
 * once you've moved to another page.
 */
let changed = false;

export const markVotesChanged = () => {
  changed = true;
};

/** True once after a vote was saved, then false until the next one. */
export const takeVotesChanged = () => {
  const was = changed;
  changed = false;
  return was;
};
