import { type RankedLine, formatScore, formatSupport, rankedSpriteUrl, type TierId, TIER_STYLE, tierDefinitions, type TierStyle, CONSENSUS_COLORS, TOP_ROW_SIZE, FIXED_SCORE_CUTOFFS } from "@/lib/tiers";

/** Candy released in the last two weeks: a blue ring and a "New" tag (export draws the same ring). */
export const NEW_CARD = "ring-2 ring-[#3fa7f5]";
export function NewTag() {
  return <span className="rounded bg-[#3fa7f5] px-1 text-[10px] font-extrabold uppercase leading-4 text-white">New</span>;
}


const panel = "card p-3";
/** The Top 3 Spotlight row isn't a tier: a dashed gold frame and a gap set it apart from S. */
const topPanel = "card mb-6 border-2 border-dashed border-sun-deep/60 bg-[#fff3c9] p-3 dark:bg-night";

/** Sign reflects support; 0 is Neutral rather than a positive rating. */
const supportColor = (support: number) => support < 0 ? "text-dont"
  : support === 0 ? "text-slate-500"
  : support >= FIXED_SCORE_CUTOFFS.S ? "text-emerald-600 dark:text-emerald-400"
  : support >= FIXED_SCORE_CUTOFFS.A ? "text-lime-600 dark:text-lime-400" : "text-amber-700 dark:text-amber-300";

function VoteCard({ ranked, consensus, pool }: { ranked: RankedLine; consensus: boolean; pool: "friends" | "everyone" }) {
  const total = ranked.wants + ranked.neutral + ranked.dontWants;
  const voteLabel = (count: number) => consensus && total > 0 ? `${Math.round(100 * count / total)}%` : count;
  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-white p-2 dark:bg-night-deep ${ranked.isNew ? NEW_CARD : ""}`}>
      <img src={rankedSpriteUrl(ranked)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold">{ranked.line.name}</span>{ranked.isNew && <NewTag />}</span>
          {!consensus && ranked.support !== null && (
            <span className="shrink-0 whitespace-nowrap" title={`Score: (${ranked.wants} Want − ½ × ${ranked.dontWants} Don't Want) ÷ ${total} ${pool === "everyone" ? "players who have seen it" : "voting friends"} × 100. Neutral counts 0. ${ranked.support! < 0 ? "Below 0 is F: more than twice as many Don't Want votes as Want votes. " : ""}Displayed scores omit decimals. Tiers use the full score.`} aria-label={`Score ${formatScore(ranked.support)}`}>
              <span className={`text-lg font-extrabold ${supportColor(ranked.support)}`}>{formatSupport(ranked.support)}</span>
              {ranked.support >= 0 && <span className="ml-0.5 text-xs text-slate-500">/100</span>}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs">
          <span className="text-want" title={consensus ? `${ranked.wants} of ${total} players` : undefined}>{voteLabel(ranked.wants)} Want</span>
          <span className="text-meh" title={consensus ? `${ranked.neutral} of ${total} players` : undefined}>{voteLabel(ranked.neutral)} Neutral</span>
          <span className="text-dont" title={consensus ? `${ranked.dontWants} of ${total} players` : undefined}>{voteLabel(ranked.dontWants)} Don&apos;t Want</span>
          {consensus && ranked.consensusNote && <span title={ranked.consensusNote === "Divisive" ? "At least one-third Want and one-third Don't Want. Rounded percentages may hide small differences." : "At least half are Neutral, without a clear Want or Don't Want lead."} className="rounded px-1 font-semibold" style={{ backgroundColor: CONSENSUS_COLORS[ranked.consensusNote === "Divisive" ? "C" : "B"].bg, color: CONSENSUS_COLORS[ranked.consensusNote === "Divisive" ? "C" : "B"].fg }}>{ranked.consensusNote}</span>}
          {ranked.tops > 0 && <span className="font-semibold text-sun-deep">★ {ranked.tops}</span>}
        </div>
      </div>
    </li>
  );
}

/**
 * `pool` words the Top 3 Spotlight blurb: "your friends" on My Friends, "players" on
 * Everyone. The Top 3 Spotlight row starts folded so the ranking leads.
 */
export function TierBoard({ tiers, pool = "friends", style = "standard" }: { tiers: Map<TierId, RankedLine[]>; pool?: "friends" | "everyone"; style?: TierStyle }) {
  return (
    <div className="space-y-3">
      {tierDefinitions(style).map((tier) => {
        const ranked = tiers.get(tier.id)!;
        if (ranked.length === 0) return null;
        const categoryColor = style === "consensus" ? CONSENSUS_COLORS[tier.id] : undefined;
        const header = (
          <>
            <span
              style={categoryColor ? { backgroundColor: categoryColor.bg, color: categoryColor.fg, boxShadow: `0 3px 0 ${categoryColor.shadow}` } : undefined}
              className={`inline-flex ${tier.id === "top" || style === "consensus" ? "min-h-12 w-24 whitespace-pre-line py-2" : "h-9 w-14"} shrink-0 items-center justify-center rounded-lg text-center font-black leading-none ${
                tier.label.length > 2 ? "text-xs" : "text-lg"
              } ${categoryColor ? "" : TIER_STYLE[tier.id]}`}
            >
              {tier.label}
            </span>
            <span className="text-sm text-slate-500">
              {/* The Top 3 Spotlight row is folded, so no count there: just what it is. */}
              {tier.id === "top" ? tier.hint : `${ranked.length} · ${tier.hint}`}
            </span>
          </>
        );
        const grid = (rows: RankedLine[]) => (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <VoteCard key={r.line.id} ranked={r} consensus={style === "consensus"} pool={pool} />
            ))}
          </ul>
        );
        // The Top 3 Spotlight row shows its first TOP_ROW_SIZE lines; the rest of the starred lines fold away.
        const folded = tier.id === "top" ? ranked.slice(TOP_ROW_SIZE) : [];
        const cards = (
          <>
            {grid(folded.length > 0 ? ranked.slice(0, TOP_ROW_SIZE) : ranked)}
            {folded.length > 0 && (
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-500 underline">
                  <span className="group-open:hidden">Show all {ranked.length} spotlighted candies</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                {grid(folded)}
              </details>
            )}
          </>
        );
        if (tier.id === "top") {
          return (
            <details key={tier.id} className={`${topPanel} group/top`}>
              {/* The blurb sits in the summary so it shows while folded. */}
              <summary className="cursor-pointer list-none">
                <span className="flex items-center gap-3">
                  {header}
                  <span className="ml-auto shrink-0 text-sm font-semibold text-slate-500 underline">
                    <span className="group-open/top:hidden">Show</span>
                    <span className="hidden group-open/top:inline">Hide</span>
                  </span>
                </span>
                <span className="mt-2 block text-sm text-slate-600 dark:text-slate-300">
                  A place for {pool === "friends" ? "your friends" : "players"} to highlight the candy they most want friends to send,
                  even when it ranks low overall. Stars don&apos;t change tier scores.
                </span>
              </summary>
              {cards}
            </details>
          );
        }
        return (
          <section key={tier.id} className={panel}>
            <div className="flex items-center gap-3">{header}</div>
            {cards}
          </section>
        );
      })}
    </div>
  );
}
