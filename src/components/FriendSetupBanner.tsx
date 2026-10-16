import Link from "next/link";
import { parseAvatar } from "@/lib/avatars";

/** Only the two friend pages use this notice; saved fields determine what's missing. */
export function FriendSetupBanner({ profile }: { profile: { ign: string | null; friend_code: string | null; game_avatar?: string | null } }) {
  const identityMissing = !profile.ign?.trim() || !profile.friend_code;
  const pictureMissing = !parseAvatar(profile.game_avatar);
  if (!identityMissing && !pictureMissing) return null;
  return <Link href="/profile?setup=profile" className="mt-3 block rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
    {identityMissing ? "Add your in-game name and friend code to add friends →" : "Choose your Pokémon Sleep icon to add friends →"}
  </Link>;
}
