import avatarData from "@/data/avatars.json";

/** In-game profile icon variants. Art from Neroli's Lab (public/avatars, Apache-2.0). */
export type AvatarVariant = "normal" | "happy" | "shiny" | "happy_shiny";

export const AVATAR_VARIANTS: [AvatarVariant, string][] = [
  ["normal", "Normal"],
  ["happy", "Happy"],
  ["shiny", "Shiny"],
  ["happy_shiny", "Happy shiny"],
];

/** Pokémon name -> the variants its art comes in (a few lack shinies). */
export const AVATARS: Record<string, AvatarVariant[]> = avatarData as Record<string, AvatarVariant[]>;
export const AVATAR_NAMES = Object.keys(AVATARS);

/** "pikachu:happy_shiny" -> ["pikachu", "happy_shiny"], or null if it isn't a known icon. */
export function parseAvatar(key: string | null | undefined): [string, AvatarVariant] | null {
  if (!key) return null;
  const [name, variant] = key.split(":") as [string, AvatarVariant];
  return AVATARS[name]?.includes(variant) ? [name, variant] : null;
}

export function avatarSrc(name: string, variant: AvatarVariant): string {
  const folder = variant.startsWith("happy") ? "happy" : "portrait";
  return `/avatars/${folder}/${name}${variant.endsWith("shiny") ? "_shiny" : ""}.webp`;
}

/** Shown for players with no icon (and no Discord picture you can see): Unown's "?" form. */
export const DEFAULT_AVATAR = "/avatars/default.webp";

/** Image URL for a stored icon key, or null. */
export function gameAvatarUrl(key: string | null | undefined): string | null {
  const parsed = parseAvatar(key);
  return parsed ? avatarSrc(...parsed) : null;
}

/** "mr_mime" -> "Mr Mime", "vulpix_alolan" -> "Vulpix Alolan". */
export const avatarLabel = (name: string) => name.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
