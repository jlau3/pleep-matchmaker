import { type Choice, linesFromIds } from "./lines";
import type { OwnProfile } from "./types";

/** What the "looking for friends" post card needs, from your profile and votes (My Friends and Find New). */
export function friendPostProps(profile: OwnProfile, choices: Record<string, Choice>, tops: string[]) {
  return {
    friendCode: profile.friend_code,
    ign: profile.ign,
    allowLookup: profile.allow_lookup,
    topNames: linesFromIds(tops).map((line) => line.name),
    wantNames: linesFromIds(Object.keys(choices).filter((id) => choices[id] === "want"))
      .sort((a, b) => Number(b.rare) - Number(a.rare) || a.dex - b.dex)
      .slice(0, 3)
      .map((line) => line.name),
  };
}
