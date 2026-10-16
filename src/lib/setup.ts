/** Setup checks follow the player's saved data, rather than visits or button clicks. */
export interface SetupProgress {
  name: boolean;
  code: boolean;
  picture: boolean;
  /** At least one Want or Don't Want. Neutral is the default. */
  voted: boolean;
  /** An accepted friend or an unexpired outgoing request. */
  friends: boolean;
}

export type SetupStepId = "profile" | "vote" | "friends" | "tiers";

export interface SetupStep {
  id: SetupStepId;
  label: string;
  next: string;
  href: string;
  cta: string;
  done: boolean;
}

export function setupSteps(progress: SetupProgress): SetupStep[] {
  const profileTask = !progress.name
    ? { next: "Add your name exactly as it appears in Pokémon Sleep, so friends can find you.", cta: "Add my name" }
    : !progress.code
      ? { next: "Add your 12-digit Pokémon Sleep friend code. Find it in Research Community in the game.", cta: "Add my friend code" }
      : { next: "Choose the Pokémon profile picture you use in the game.", cta: "Choose my picture" };
  return [
    {
      id: "profile",
      label: "Profile setup",
      ...profileTask,
      href: "/profile?setup=profile",
      done: progress.name && progress.code && progress.picture,
    },
    {
      id: "vote",
      label: "Candy choices",
      next: "Pick Want or Don't Want for the candy you care about. Start with a few; the rest can stay Neutral.",
      href: "/vote",
      cta: "Choose my candy",
      done: progress.voted,
    },
    {
      id: "friends",
      label: "Add a friend",
      next: "Look up your Pokémon Sleep friends by their exact in-game name, or find new friends. Send a request to get started.",
      href: "/friends",
      cta: "Add friends",
      done: progress.friends,
    },
    {
      id: "tiers",
      label: "See Tier List",
      next: "See which candies your friends want most. It fills in as they accept and vote.",
      href: "/tiers?pool=friends",
      cta: "See Tier List",
      done: false,
    },
  ];
}

export function currentStep(steps: SetupStep[]): SetupStep {
  return steps.find((step) => !step.done) ?? steps[steps.length - 1];
}

/** Live completion on My Votes, emitted only after the vote was saved successfully. */
export const SETUP_VOTE_EVENT = "pm-setup-vote-saved";
export function notifySetupVotesSaved(userId: string, voted: boolean) {
  window.dispatchEvent(new CustomEvent(SETUP_VOTE_EVENT, { detail: { userId, voted } }));
}
