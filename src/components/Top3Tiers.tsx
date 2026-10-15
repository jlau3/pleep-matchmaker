import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { TIER_STYLE } from "@/lib/tiers";

/**
 * Your Top 3 on another player's Tier List: each starred candy with the tier
 * it sits in there (same letters and colours as the Tier List), so you can
 * see who's likeliest to send your favorites. Nothing if you haven't starred any.
 */
export function Top3Tiers({
  tops,
  tiers,
  compact = false,
}: {
  /** Your starred line ids. */
  tops: string[];
  /** Line → tier on their list; undefined when they have no list yet. */
  tiers: Record<string, string> | undefined;
  /** Grid tiles: no label, smaller. */
  compact?: boolean;
}) {
  const lines = tops.flatMap((id) => LINES_BY_ID.get(id) ?? []);
  if (lines.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? "justify-center text-xs" : "mt-3 text-sm"}`}>
      {!compact && <span className="text-slate-500">Your Top 3 on their list:</span>}
      {tiers ? (
        lines.map((line) => {
          const tier = tiers[line.id];
          return (
            <span key={line.id} className="inline-flex items-center gap-0.5" title={`${line.name}: ${tier ?? "?"} on their Tier List`}>
              <img src={lineSpriteUrl(line)} alt={line.name} className={compact ? "h-6 w-6" : "h-7 w-7"} />
              <span className={`rounded-md px-1.5 text-xs font-extrabold leading-5 ${TIER_STYLE[tier === "Avoid" ? "avoid" : tier] ?? ""}`}>
                {tier ?? "–"}
              </span>
            </span>
          );
        })
      ) : (
        <span className="text-slate-500">no Tier List yet (none of their friends has voted)</span>
      )}
    </div>
  );
}
