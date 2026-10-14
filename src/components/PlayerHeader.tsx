import { formatFriendCode, relativeTime } from "@/lib/format";
import type { PlayerContact } from "@/lib/types";
import { BlockButton } from "./BlockButton";
import { CopyButton } from "./CopyButton";
import { FriendButton } from "./FriendButton";

/** In-game name first (what friends know them by in Pokémon Sleep), else their shown Discord name. */
export function playerName(p: Pick<PlayerContact, "discord_display_name" | "discord_username" | "ign">): string {
  return p.ign || p.discord_display_name || p.discord_username || "Unknown player";
}

/** The Discord line under the name: "Display · @username", minus whatever the top line already shows. */
function discordLine(p: PlayerContact, name: string): string | null {
  const parts = [
    p.discord_display_name && p.discord_display_name !== name ? p.discord_display_name : null,
    p.discord_username ? `@${p.discord_username}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Avatar, IGN and Discord names, friend code and activity for one player. */
export function PlayerHeader({
  player,
  aside,
  isFriend,
  placeholder,
  actions,
}: {
  player: PlayerContact;
  aside?: React.ReactNode;
  /** Shows the add/remove friend button when set. */
  isFriend?: boolean;
  /** Not here yet name the player was searched from (see FriendButton). */
  placeholder?: string;
  /** Extra buttons on the same line as the friend button (e.g. "Not now"). */
  actions?: React.ReactNode;
}) {
  const name = playerName(player);
  const discord = discordLine(player, name);
  return (
    <div className="space-y-2">
      {/* Avatar, name and the aside (fits) on top; everything else full width below, flush left. */}
      <div className="flex items-start gap-3">
        {player.avatar_url ? (
          <img src={player.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
        )}
        <div className="min-w-0 flex-1 self-center">
          {/* IGN, then their Discord names on their own line; long names wrap and the Discord line trims, so neither runs into the fits. */}
          <span className="block break-words font-semibold">{name}</span>
          {discord && (
            <span className="block truncate text-sm text-slate-500" title={discord}>
              {discord}
            </span>
          )}
        </div>
        {aside}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {player.friend_code && (
          <span className="flex items-center gap-2 whitespace-nowrap">
            FC <strong className="font-mono">{formatFriendCode(player.friend_code)}</strong>
            <CopyButton text={player.friend_code} label="friend code" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-[13px] text-slate-500">
        <span>Seen {relativeTime(player.last_seen_at)}</span>
        <span>Prefs updated {relativeTime(player.prefs_updated_at)}</span>
        <BlockButton userId={player.user_id} name={name} />
      </div>
      {(isFriend !== undefined || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {isFriend !== undefined && <FriendButton userId={player.user_id} isFriend={isFriend} name={name} placeholder={placeholder} />}
          {actions}
        </div>
      )}
    </div>
  );
}
