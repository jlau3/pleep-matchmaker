import { lineSpriteUrl } from "@/lib/lines";
import { type RankedLine, type TierId, TIERS } from "@/lib/tiers";

const TIER_STYLE: Record<string, string> = {
  S: "bg-rose-500 text-white",
  A: "bg-orange-400 text-white",
  B: "bg-amber-300 text-slate-900",
  C: "bg-lime-300 text-slate-900",
  avoid: "bg-slate-500 text-white",
  none: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const panel = "rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900";

function VoteCard({ ranked }: { ranked: RankedLine }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
      <img src={lineSpriteUrl(ranked.line)} alt="" loading="lazy" className="h-14 w-14 shrink-0 object-contain" />
      <div className="min-w-0">
        <div className="truncate font-semibold">{ranked.line.name}</div>
        <div className="flex flex-wrap gap-x-2 text-xs">
          <span className="text-want">{ranked.wants} want</span>
          <span className="text-meh">{ranked.unsure} unsure</span>
          <span className="text-dont">{ranked.dontWants} don&apos;t want</span>
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
              {ranked.length} · {tier.hint}
            </span>
          </>
        );
        const cards = (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((r) => (
              <VoteCard key={r.line.id} ranked={r} />
            ))}
          </ul>
        );
        if (tier.id === "none") {
          return (
            <details key={tier.id} className={panel}>
              <summary className="flex items-center gap-3">{header}</summary>
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
