import { lineSpriteUrl } from "@/lib/lines";
import { type RankedLine, type TierId, TIERS, TOP_ROW_SIZE } from "@/lib/tiers";

const TIER_STYLE: Record<string, string> = {
  top: "bg-gradient-to-br from-sun to-[#ff8fab] text-[#5b3e00] shadow-[0_3px_0_var(--color-sun-deep)]",
  S: "bg-[#ff8fab] text-white shadow-[0_3px_0_#e0607f]",
  A: "bg-[#ffb36b] text-white shadow-[0_3px_0_#e08a3a]",
  B: "bg-sun text-[#5b3e00] shadow-[0_3px_0_var(--color-sun-deep)]",
  C: "bg-[#a8dd7a] text-[#2f5a12] shadow-[0_3px_0_#7cba4c]",
  avoid: "bg-meh text-white shadow-[0_3px_0_#6b778a]",
};

const panel = "card p-3";

/** "+28", "0", "−5" (a real minus sign, so it lines up with the plus). */
const formatScore = (score: number) => (score > 0 ? `+${score}` : score < 0 ? `−${-score}` : "0");

function VoteCard({ ranked }: { ranked: RankedLine }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-2 dark:bg-night-deep">
      <img src={lineSpriteUrl(ranked.line)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{ranked.line.name}</span>
          {ranked.wantShare !== null && (
            <span
              className={`shrink-0 text-sm font-bold ${
                ranked.score > 0 ? "text-want" : ranked.score < 0 ? "text-dont" : "text-slate-400"
              }`}
            >
              {formatScore(ranked.score)} <span className="text-xs font-normal text-slate-500">score</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs">
          <span className="text-want">{ranked.wants} want</span>
          <span className="text-meh">{ranked.unsure} unsure</span>
          <span className="text-dont">{ranked.dontWants} don&apos;t want</span>
          {ranked.tops > 0 && <span className="font-semibold text-sun-deep">★ {ranked.tops}</span>}
        </div>
      </div>
    </li>
  );
}

export function TierBoard({ tiers }: { tiers: Map<TierId, RankedLine[]> }) {
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
              {tier.id === "top" && ranked.length > TOP_ROW_SIZE ? `${TOP_ROW_SIZE} of ${ranked.length}` : ranked.length} · {tier.hint}
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
