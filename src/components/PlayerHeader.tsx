import { DEFAULT_AVATAR, gameAvatarUrl } from "@/lib/avatars";
import { activityLabel, formatFriendCode, staleFriend } from "@/lib/format";
import type { PlayerContact } from "@/lib/types";
import { BlockButton } from "./BlockButton";
import { DiscordIcon, RedditIcon } from "./BrandIcons";
import { CopyButton } from "./CopyButton";
import type { Relation } from "@/lib/relations";
import { FriendAction } from "./FriendAction";

/** In-game name first (what friends know them by in Pokémon Sleep), else their shown Discord name, else Reddit name. */
export function playerName(
  p: Pick<PlayerContact, "discord_display_name" | "discord_username" | "ign"> & { reddit_username?: string | null },
): string {
  return p.ign || p.discord_display_name || p.discord_username || (p.reddit_username ? `u/${p.reddit_username}` : "Unknown player");
}

/** The Discord line under the name: "Display · @username", minus whatever the top line already shows. */
function discordLine(p: PlayerContact, name: string): string | null {
  const parts = [
    p.discord_display_name && p.discord_display_name !== name ? p.discord_display_name : null,
    p.discord_username ? `@${p.discord_username}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Their in-game icon if they picked one, else their shown Discord picture, else the default "?" (Unown). */
export function playerAvatar(p: Pick<PlayerContact, "game_avatar" | "avatar_url">): string {
  return gameAvatarUrl(p.game_avatar) ?? p.avatar_url ?? DEFAULT_AVATAR;
}

/** Avatar, IGN, Discord and Reddit names, friend code and activity for one player. */
export function PlayerHeader({
  player,
  aside,
  relation,
  placeholder,
  actions,
  warnStale = false,
}: {
  player: PlayerContact;
  warnStale?: boolean;
  aside?: React.ReactNode;
  /** Shows the friend button (send request, accept, remove…) for where you stand with them. */
  relation?: Relation;
  /** Not here yet name the player was found from (see FriendAction). */
  placeholder?: string;
  /** Extra buttons on the same line as the friend button (e.g. "Not now"). */
  actions?: React.ReactNode;
}) {
  const name = playerName(player);
  const discord = discordLine(player, name);
  const avatar = playerAvatar(player);
  const game = Boolean(gameAvatarUrl(player.game_avatar));
  // Pokémon art (their icon or the default) sits on a tinted circle; a Discord photo fills it.
  const art = game || !player.avatar_url;
  return (
    <div className="space-y-2">
      {/* Activity follows identity, independently of a taller fit/Spotlight column. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={avatar}
              alt=""
              title={game ? "Their Pokémon Sleep icon" : art ? "No icon picked" : undefined}
              className={`h-12 w-12 shrink-0 rounded-full ${art ? "bg-sky object-contain dark:bg-night-deep" : ""}`}
            />
            <div className="min-w-0 flex-1">
              {/* IGN, then Discord and Reddit names on their own lines; long names wrap and the others trim, so none run into the fits. */}
              <span className="block break-words font-semibold">{name}</span>
              {discord && (
                <span className="flex min-w-0 items-center gap-1 text-sm text-slate-500" title={`Discord: ${discord}`}>
                  <DiscordIcon />
                  <span className="truncate">{discord}</span>
                </span>
              )}
              {player.reddit_username && name !== `u/${player.reddit_username}` && (
                <span className="flex min-w-0 items-center gap-1 text-sm text-slate-500" title="Reddit name (added by the player, not verified)">
                  <RedditIcon />
                  <span className="truncate">u/{player.reddit_username}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-[13px] text-slate-500">
            <span>{warnStale && staleFriend(player.last_seen_at) ? "Last here over 2 months ago. Their votes may be stale." : activityLabel(player.last_seen_at)}</span>
            <BlockButton userId={player.user_id} name={name} />
          </div>
        </div>
        {aside}
      </div>
      {player.friend_code && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-2 whitespace-nowrap">
            FC <strong className="font-mono">{formatFriendCode(player.friend_code)}</strong>
            <CopyButton text={player.friend_code} label="friend code" />
          </span>
        </div>
      )}
      {(relation !== undefined || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {relation !== undefined && (
            <FriendAction userId={player.user_id} name={name} relation={relation} showsCode={Boolean(player.friend_code)} placeholder={placeholder} />
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
