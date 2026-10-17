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

/** Pumpkaboo and Gourgeist used to have one icon per size ("pumpkaboo_small"); now one each. */
const SIZED_FORM = /^(pumpkaboo|gourgeist)_(small|medium|large|jumbo)$/;

/** "pikachu:happy_shiny" -> ["pikachu", "happy_shiny"], or null if it isn't a known icon. */
export function parseAvatar(key: string | null | undefined): [string, AvatarVariant] | null {
  if (!key) return null;
  const [stored, variant] = key.split(":") as [string, AvatarVariant];
  const name = stored?.replace(SIZED_FORM, "$1");
  return AVATARS[name]?.includes(variant) ? [name, variant] : null;
}

/** The stored key for an icon ("pumpkaboo_small:happy" -> "pumpkaboo:happy"), or null. */
export const avatarKey = (key: string | null | undefined) => parseAvatar(key)?.join(":") ?? null;

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
