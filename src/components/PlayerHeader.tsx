import { formatFriendCode, relativeTime } from "@/lib/format";
import type { PlayerContact } from "@/lib/types";
import { BlockButton } from "./BlockButton";
import { CopyButton } from "./CopyButton";
import { FriendButton } from "./FriendButton";

/** Discord name when the player shows it, otherwise their IGN (Google/email players, or Discord name hidden). */
export function playerName(p: Pick<PlayerContact, "discord_display_name" | "discord_username" | "ign">): string {
  return p.discord_display_name || p.discord_username || p.ign || "Unknown player";
}

/** Avatar, names, IGN, friend code and activity for one player. */
export function PlayerHeader({
  player,
  aside,
  isFriend,
  actions,
}: {
  player: PlayerContact;
  aside?: React.ReactNode;
  /** Shows the add/remove friend button when set. */
  isFriend?: boolean;
  /** Extra buttons on the same line as the friend button (e.g. "Not now"). */
  actions?: React.ReactNode;
}) {
  const name = playerName(player);
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
          {/* Name, then @username on its own line; long names wrap and long @names trim, so neither runs into the fits. */}
          <span className="block break-words font-semibold">{name}</span>
          {player.discord_username && (
            <span className="block truncate text-sm text-slate-500" title={`@${player.discord_username}`}>
              @{player.discord_username}
            </span>
          )}
        </div>
        {aside}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {player.ign && (
          <span>
            IGN <strong>{player.ign}</strong>
          </span>
        )}
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
          {isFriend !== undefined && <FriendButton userId={player.user_id} isFriend={isFriend} name={name} />}
          {actions}
        </div>
      )}
    </div>
  );
}
