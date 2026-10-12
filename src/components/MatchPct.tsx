import { LOW_FIT_PCT } from "@/lib/fit";

/**
 * How well a player fits your friends' wants, shown top right of their card.
 * Low fits get a quiet amber "low fit" instead of the green "fit". Nothing when unknown.
 */
export function MatchPct({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  const low = pct < LOW_FIT_PCT;
  return (
    <div
      className="shrink-0 text-right leading-none"
      title={low ? "Most of what they want isn't on your friends' lists" : "How much of what they want your friends want too"}
    >
      <div className={`text-2xl font-bold ${low ? "text-amber-600 dark:text-amber-400" : "text-want"}`}>{pct}%</div>
      <div className={`text-xs ${low ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
        {low ? "low fit" : "fit"}
      </div>
    </div>
  );
}
