import { LOW_FIT_PCT } from "@/lib/fit";

/**
 * How well a player fits your friends' wants, shown top right of their card.
 * Counts their wants and their don't-wants against what your friends want.
 * Low fits get a quiet amber "low fit" instead of the green "fit". Nothing when unknown.
 */
export function MatchPct({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  const low = pct < LOW_FIT_PCT;
  return (
    <div
      className="shrink-0 whitespace-nowrap text-right leading-none"
      title={
        low
          ? "Their wants and don't-wants mostly don't line up with your current friends list"
          : "How closely their wants and don't-wants line up with your current friends list"
      }
    >
      <span className={`text-2xl font-bold ${low ? "text-amber-600 dark:text-amber-400" : "text-want"}`}>{pct}%</span>{" "}
      <span className={`text-xs ${low ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
        {low ? "low fit" : "fit"}
      </span>
    </div>
  );
}
