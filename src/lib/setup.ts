/** Where a new player stands, read off their real data (SetupChecklist). */
export interface SetupProgress {
  /** IGN, friend code and an in-game icon are all set. */
  profile: boolean;
  /** At least one Want or Don't Want. */
  voted: boolean;
  /** Has a friend, or an open request out to someone. */
  friends: boolean;
}

export type SetupStepId = "profile" | "vote" | "friends" | "tiers";

export interface SetupStep {
  id: SetupStepId;
  label: string;
  /** What to do, shown while it's the current step. */
  next: string;
  href: string;
  cta: string;
  done: boolean;
}

/**
 * The four setup steps in order. The Tier List step is never done here: the
 * checklist finishes when the player opens the Tier List with the first three
 * done (or skips it).
 */
export function setupSteps(progress: SetupProgress): SetupStep[] {
  return [
    {
      id: "profile",
      label: "Profile",
      next: "Add your in-game name, friend code and the icon you use in Pokémon Sleep, so friends know it's you.",
      href: "/profile?setup=profile",
      cta: "Set up profile",
      done: progress.profile,
    },
    {
      id: "vote",
      label: "Vote",
      next: "Pick Want or Don't Want for the candy you care about. Start with a few; the rest can stay Neutral.",
      href: "/vote",
      cta: "Let's vote",
      done: progress.voted,
    },
    {
      id: "friends",
      label: "Add friends",
      next: "Look up your Pokémon Sleep friends by their exact in-game name, or find new friends. Send a request to get started.",
      href: "/friends",
      cta: "Add friends",
      done: progress.friends,
    },
    {
      id: "tiers",
      label: "Tier List",
      next: "See which candies your friends want most. It fills in as they accept and vote.",
      href: "/tiers?pool=friends",
      cta: "See Tier List",
      done: false,
    },
  ];
}

/** The first step not done yet. */
export function currentStep(steps: SetupStep[]): SetupStep {
  return steps.find((step) => !step.done) ?? steps[steps.length - 1];
}
