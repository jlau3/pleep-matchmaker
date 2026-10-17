import type { MatchContext } from "@/lib/matchContext";
import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { TIER_STYLE } from "@/lib/tiers";
import { FitPair } from "./FitPair";

/**
 * Your Top 3 on another player's Tier List: each starred candy with the tier
 * it sits in there (same letters and colours as the Tier List), so you can
 * see who's likeliest to send your favorites. No label: it sits under the
 * fits on cards (FitWithTop3) and on grid tiles. Nothing if you haven't starred
 * any. A player with no voting friends shows dashes, for the Spotlight badges only.
 */
export function Top3Tiers({
  tops,
  tiers,
  align = "center",
}: {
  /** Your starred line ids. */
  tops: string[];
  /** Line → tier on their list. Empty or missing: no list yet (dashes). A missing line in a partial map is unavailable. */
  tiers: Record<string, string> | undefined;
  /** "end" under the fits at a card's top right; "center" on grid tiles. */
  align?: "center" | "end";
}) {
  const lines = tops.flatMap((id) => LINES_BY_ID.get(id) ?? []);
  if (lines.length === 0) return null;
  const noList = !tiers || Object.keys(tiers).length === 0;
  return (
    <div className={`flex items-center gap-x-1.5 text-xs ${align === "end" ? "justify-end" : "flex-wrap justify-center"}`}>
      {lines.map((line) => {
        // Avoid: the weighted score on their friends' Tier List is negative.
        const tier = noList ? null : (tiers[line.id] ?? null);
        return (
          <span
            key={line.id}
            className="inline-flex items-center"
            title={
              !tier
                ? noList ? `${line.name}: no list yet (none of their friends have saved votes)` : `${line.name}: rank unavailable`
                : tier === "Avoid"
                  ? `${line.name}: F on their Percentile Tier List, unlikely from this player`
                  : `${line.name}: ${tier} on their Percentile Tier List`
            }
          >
            <img src={lineSpriteUrl(line)} alt={line.name} className="h-5 w-5" />
            <span
              className={`rounded px-1 text-[11px] font-extrabold leading-4 ${
                tier ? TIER_STYLE[tier === "Avoid" ? "avoid" : tier] : "text-slate-500"
              }`}
            >
              {tier === "Avoid" ? "F" : tier ?? "–"}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** A card's top right: both fits, with your Top 3's tiers underneath when given. */
export function FitWithTop3({ they, you, tops, tiers, context, onlyYou = false }: { onlyYou?: boolean; context?: MatchContext; they?: number | null; you: number | null | undefined; tops?: string[]; tiers?: Record<string, string> }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <FitPair they={they} you={you} context={context} onlyYou={onlyYou} />
      {tops && <Top3Tiers tops={tops} tiers={tiers} align="end" />}
    </div>
  );
}
