import { LOW_FIT_PCT } from "@/lib/fit";

/**
 * Fit %, shown top right of a player's card. Low fits get a quiet amber "low
 * fit" instead of the green "fit". Nothing when unknown.
 *
 * Two meanings, matching where it's shown:
 *  - default (My Friends, search): how their wants and don't-wants line up
 *    with your current friends list.
 *  - theirList (Find New Friends): how much of what you want their Tier List
 *    (their friends) wants, i.e. whether they'd send you candy you want.
 */
export function MatchPct({ pct, theirList = false }: { pct: number | null | undefined; theirList?: boolean }) {
  if (pct === null || pct === undefined) return null;
  const low = pct < LOW_FIT_PCT;
  return (
    <div
      className="shrink-0 whitespace-nowrap text-right leading-none"
      title={
        theirList
          ? low
            ? "Their friends mostly don't want what you want"
            : "How much of what you want their friends want"
          : low
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
