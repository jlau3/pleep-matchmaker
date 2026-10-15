import { formatFriendCode } from "@/lib/format";
import { lineSpriteUrl, linesFromIds } from "@/lib/lines";
import type { Relation } from "@/lib/relations";
import type { MatchRow } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { FitPair } from "./FitPair";
import { FriendAction } from "./FriendAction";
import { playerAvatar, playerName } from "./PlayerHeader";
import { Top3Tiers } from "./Top3Tiers";

/**
 * Grid view: one compact tile per player, like an in-game friend list. Icon,
 * name, both fits, Top 3 sprites, friend code and the request button; the
 * list view keeps the full breakdown.
 */
export function MatchTile({
  match,
  relation,
  top3,
}: {
  match: MatchRow;
  relation: Relation;
  /** Sorting by your Top 3: your starred lines and their tiers on this player's list (instead of their own Top 3). */
  top3?: { tops: string[]; tiers: Record<string, string> | undefined };
}) {
  const name = playerName(match);
  const avatar = playerAvatar(match);
  const tops = linesFromIds(match.top_wants ?? []);
  return (
    <li className="card flex flex-col items-center gap-2 p-3 text-center">
      <img src={avatar} alt="" className="h-16 w-16 rounded-full bg-sky object-contain dark:bg-night-deep" />
      <span className="w-full truncate font-semibold" title={name}>
        {name}
      </span>
      <FitPair they={match.match_pct} you={match.you_fit_pct} compact />
      {top3 ? (
        <Top3Tiers tops={top3.tops} tiers={top3.tiers} />
      ) : (
        tops.length > 0 && (
          <span className="flex gap-1" title={`Top ${tops.length}: ${tops.map((l) => l.name).join(", ")}`}>
            {tops.map((line) => (
              <img key={line.id} src={lineSpriteUrl(line)} alt={line.name} className="h-8 w-8" />
            ))}
          </span>
        )
      )}
      {match.friend_code && (
        <span className="flex items-center gap-1 whitespace-nowrap text-[11px]">
          <span className="font-mono">{formatFriendCode(match.friend_code)}</span>
          <CopyButton text={match.friend_code} label="friend code" />
        </span>
      )}
      {/* Centered in the tile (FriendAction lines up left on full cards). */}
      <div className="flex w-full justify-center [&>span]:items-center [&>span>span]:justify-center">
        <FriendAction userId={match.user_id} name={name} relation={relation} showsCode={Boolean(match.friend_code)} />
      </div>
    </li>
  );
}
