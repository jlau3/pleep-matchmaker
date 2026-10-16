import { type RankedLine, rankedSpriteUrl, type TierId, TIER_STYLE, TIERS, TOP_ROW_SIZE } from "@/lib/tiers";


const panel = "card p-3";
/** The Top 3 row isn't a tier: a dashed gold frame and a gap set it apart from S. */
const topPanel = "card mb-6 border-2 border-dashed border-sun-deep/60 bg-[#fff3c9] p-3 dark:bg-night";

/**
 * Rating color in five 20-point bands, red (nobody wants it) through yellow
 * (around 50, the Avoid line) to green (everyone wants it; all Neutral is 67).
 */
const RATING_BANDS: [number, string][] = [
  [80, "text-emerald-600 dark:text-emerald-400"],
  [60, "text-lime-600 dark:text-lime-400"],
  [40, "text-yellow-600 dark:text-yellow-400"],
  [20, "text-orange-600 dark:text-orange-400"],
  [0, "text-red-600 dark:text-red-400"],
];
const ratingColor = (rating: number) => RATING_BANDS.find(([min]) => rating >= min)![1];

function VoteCard({ ranked }: { ranked: RankedLine }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-2 dark:bg-night-deep">
      <img src={rankedSpriteUrl(ranked)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{ranked.line.name}</span>
          {ranked.rating !== null && (
            <span className="shrink-0 whitespace-nowrap">
              <span className={`text-lg font-extrabold ${ratingColor(ranked.rating)}`}>{ranked.rating}</span>
              <span className="text-xs text-slate-400">/100</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs">
          <span className="text-want">{ranked.wants} Want</span>
          <span className="text-meh">{ranked.neutral} Neutral</span>
          <span className="text-dont">{ranked.dontWants} Don&apos;t Want</span>
          {ranked.tops > 0 && <span className="font-semibold text-sun-deep">★ {ranked.tops}</span>}
        </div>
      </div>
    </li>
  );
}

/**
 * `pool` words the Top 3 blurb: "your friends" on My Friends, "players" on
 * Everyone. The Top 3 row starts folded so the ranking leads.
 */
export function TierBoard({ tiers, pool = "friends" }: { tiers: Map<TierId, RankedLine[]>; pool?: "friends" | "everyone" }) {
  return (
    <div className="space-y-3">
      {TIERS.map((tier) => {
        const ranked = tiers.get(tier.id)!;
        if (ranked.length === 0) return null;
        const header = (
          <>
            <span
              className={`inline-flex h-9 w-14 shrink-0 items-center justify-center rounded-lg text-center font-black leading-none ${
                tier.label.length > 2 ? "text-xs" : "text-lg"
              } ${TIER_STYLE[tier.id]}`}
            >
              {tier.label}
            </span>
            <span className="text-sm text-slate-500">
              {/* The Top 3 row is folded, so no count there: just what it is. */}
              {tier.id === "top" ? tier.hint : `${ranked.length} · ${tier.hint}`}
            </span>
          </>
        );
        const grid = (rows: RankedLine[]) => (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <VoteCard key={r.line.id} ranked={r} />
            ))}
          </ul>
        );
        // The Top 3 row shows its first TOP_ROW_SIZE lines; the rest of the starred lines fold away.
        const folded = tier.id === "top" ? ranked.slice(TOP_ROW_SIZE) : [];
        const cards = (
          <>
            {grid(folded.length > 0 ? ranked.slice(0, TOP_ROW_SIZE) : ranked)}
            {folded.length > 0 && (
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-500 underline">
                  <span className="group-open:hidden">Show all {ranked.length} Top 3 picks</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                {grid(folded)}
              </details>
            )}
          </>
        );
        if (tier.id === "top") {
          const who = pool === "friends" ? "your friends" : "players";
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
                  Candy {who} want most, from their personal Top 3. Some rank low on the Tier List below,
                  but whoever starred them really wants them.
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
