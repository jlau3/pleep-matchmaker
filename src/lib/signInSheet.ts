/** Shared by nav locks, public Tier List and direct private links. */
export function signInReason(destination: string): string {
  const path = destination.split("?")[0];
  if (path === "/tiers") return "Sign in to see your friends’ Tier List.";
  if (path === "/matches") return "Sign in to find new Pokémon Sleep friends.";
  if (path === "/friends") return "Sign in to find and add your Pokémon Sleep friends.";
  if (path === "/vote" || path === "/profile") return "Sign in to save your candy wishlist and set up your profile.";
  if (path === "/guides") return "Sign in to browse the candy guides.";
  return "Sign in to use your personal Pleep Matchmaker features.";
}
