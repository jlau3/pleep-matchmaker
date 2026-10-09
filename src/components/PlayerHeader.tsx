import { formatFriendCode, relativeTime } from "@/lib/format";
import type { PlayerContact } from "@/lib/types";
import { BlockButton } from "./BlockButton";
import { CopyButton } from "./CopyButton";
import { FriendButton } from "./FriendButton";

export function playerName(p: Pick<PlayerContact, "discord_display_name" | "discord_username">): string {
  return p.discord_display_name || p.discord_username || "Unknown player";
}

/** Avatar, names, IGN, friend code and activity for one player. */
export function PlayerHeader({
  player,
  aside,
  isFriend,
}: {
  player: PlayerContact;
  aside?: React.ReactNode;
  /** Shows the add/remove friend button when set. */
  isFriend?: boolean;
}) {
  const name = playerName(player);
  return (
    <div className="flex items-start gap-3">
      {player.avatar_url ? (
        <img src={player.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div>
          <span className="font-semibold">{name}</span>
          {player.discord_username && <span className="ml-2 text-sm text-slate-500">@{player.discord_username}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {player.ign && (
            <span>
              IGN <strong>{player.ign}</strong>
            </span>
          )}
          {player.friend_code && (
            <span className="flex items-center gap-2">
              FC <strong className="font-mono">{formatFriendCode(player.friend_code)}</strong>
              <CopyButton text={player.friend_code} label="friend code" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
          <span>Seen {relativeTime(player.last_seen_at)}</span>
          <span>Prefs updated {relativeTime(player.prefs_updated_at)}</span>
          <BlockButton userId={player.user_id} name={name} />
        </div>
        {isFriend !== undefined && (
          <div className="pt-1">
            <FriendButton userId={player.user_id} isFriend={isFriend} />
          </div>
        )}
      </div>
      {aside}
    </div>
  );
}
