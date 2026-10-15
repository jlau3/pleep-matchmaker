import { parseAvatar } from "./avatars";
import { normalizeFriendCode } from "./format";

export interface ProfileGuideStep {
  id: "ign" | "friend_code" | "game_avatar" | "visibility" | "sharing";
  title: string;
  description: string;
}

export function profileGuideSteps(hasSocialNames: boolean): ProfileGuideStep[] {
  const steps: ProfileGuideStep[] = [
    {
      id: "ign",
      title: "Add your in-game name",
      description: "Enter your name exactly as it appears in Pokémon Sleep. This is how your friends will look you up.",
    },
    {
      id: "friend_code",
      title: "Add your Pokémon Sleep friend code",
      description:
        "Copy your 12-digit code from Research Community in Pokémon Sleep. You need it to search and add friends here; it is shared when you send a friend request with your code.",
    },
    {
      id: "game_avatar",
      title: "Choose your Pokémon Sleep profile picture",
      description:
        "Tap Choose picture in the highlighted box, select the Pokémon picture you use in Pokémon Sleep, then tap Use this picture. This is required to complete profile setup and helps friends recognize you.",
    },
    {
      id: "visibility",
      title: "Choose who can find you",
      description:
        "Everyone includes friend suggestions. People who know me allows exact-name or code searches. Only my friends hides you from both. Existing friend requests are still visible to the people involved.",
    },
  ];
  if (hasSocialNames)
    steps.push({
      id: "sharing",
      title: "Choose which names to share",
      description:
        "These switches control your social names, separately from who can find you. Discord names can also appear on requests between you; your Reddit name can appear to people you send a request to. Turn a switch off to hide that name.",
    });
  return steps;
}

/** Start at the first missing essential; completed profiles start at privacy. */
export function firstProfileGuideStep(profile: { ign: string | null; friend_code: string | null; game_avatar?: string | null }): number {
  if (!profile.ign?.trim()) return 0;
  if (!profile.friend_code || !normalizeFriendCode(profile.friend_code)) return 1;
  if (!parseAvatar(profile.game_avatar ?? "")) return 2;
  return 3;
}

/** Validate the highlighted field before submitting or moving the guide on. */
export function profileGuideError(step: ProfileGuideStep["id"], form: FormData): string | null {
  if (step === "ign" && !String(form.get("ign") ?? "").trim()) return "Enter your in-game name above to continue.";
  if (step === "friend_code" && !normalizeFriendCode(String(form.get("friend_code") ?? "")))
    return "Enter your 12-digit friend code above to continue.";
  if (step === "game_avatar" && !parseAvatar(String(form.get("game_avatar") ?? "")))
    return "Tap Choose picture in the highlighted box, pick a Pokémon, then select Use this picture.";
  return null;
}
