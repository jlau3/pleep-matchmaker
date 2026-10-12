import { lineSpriteUrl } from "@/lib/lines";
import { type RankedLine, type TierId, TIERS } from "@/lib/tiers";

const TIER_STYLE: Record<string, string> = {
  S: "bg-[#ff8fab] text-white shadow-[0_3px_0_#e0607f]",
  A: "bg-[#ffb36b] text-white shadow-[0_3px_0_#e08a3a]",
  B: "bg-sun text-[#5b3e00] shadow-[0_3px_0_var(--color-sun-deep)]",
  C: "bg-[#a8dd7a] text-[#2f5a12] shadow-[0_3px_0_#7cba4c]",
  avoid: "bg-meh text-white shadow-[0_3px_0_#6b778a]",
};

const panel = "card p-3";

function VoteCard({ ranked }: { ranked: RankedLine }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-2 dark:bg-night-deep">
      <img src={lineSpriteUrl(ranked.line)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night" />
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
