import { type RankedLine, type TierId, TIERS } from "@/lib/tiers";
import { LineChips } from "./LineChips";

const TIER_STYLE: Record<string, string> = {
  S: "bg-rose-500 text-white",
  A: "bg-orange-400 text-white",
  B: "bg-amber-300 text-slate-900",
  C: "bg-lime-300 text-slate-900",
  avoid: "bg-slate-500 text-white",
  none: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function TierBoard({ tiers }: { tiers: Map<TierId, RankedLine[]> }) {
  return (
    <div className="space-y-3">
      {TIERS.map((tier) => {
        const ranked = tiers.get(tier.id)!;
        if (ranked.length === 0) return null;
        const body = (
          <LineChips lines={ranked.map((r) => r.line)} counts={new Map(ranked.map((r) => [r.line.id, r.net]))} />
        );
        const badge = (
          <span className={`inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-center font-black leading-none ${tier.label.length > 2 ? "text-xs" : "text-lg"} ${TIER_STYLE[tier.id]}`}>
            {tier.label}
          </span>
        );
        if (tier.id === "none") {
          return (
            <details key={tier.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex items-center gap-3">
                {badge}
                <span className="text-sm text-slate-500">
                  {ranked.length} with no net votes · {tier.hint}
                </span>
              </summary>
              <div className="mt-3">{body}</div>
            </details>
          );
        }
        return (
          <section key={tier.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-1">
              {badge}
              <span className="w-14 text-center text-[10px] leading-tight text-slate-500">{tier.hint}</span>
            </div>
            <div className="min-w-0 flex-1">{body}</div>
          </section>
        );
      })}
    </div>
  );
}
