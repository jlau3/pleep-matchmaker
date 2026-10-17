import { matchSourceLabel, missingMatchReason, type MatchContext } from "@/lib/matchContext";
import { candyUtility, shareLabel } from "@/lib/fit";

/** Estimated shares, not a weighted match percentage. Suggestions/requests show only the viewer's side. */
export function FitPair({ they, you, compact = false, context, onlyYou = false }: {
  they?: number | null;
  you: number | null | undefined;
  context?: MatchContext;
  compact?: boolean;
  onlyYou?: boolean;
}) {
  function direction(label: "For you" | "For them", want: number | null | undefined, unwanted: number | null | undefined, utility: number | null | undefined, source: string, voted?: boolean | null) {
    const exactUtility = utility ?? candyUtility(want, unwanted);
    const low = want != null && exactUtility != null && exactUtility <= 0;
    const color = want == null ? "text-slate-500" : low ? "text-amber-600 dark:text-amber-400" : "text-want";
    const explanation = want == null ? missingMatchReason(label === "For you" ? "you" : "them", voted)
      : `${label}: an estimated ${shareLabel(want)} of received candy matches ${label === "For you" ? "your" : "their"} Wants; ${shareLabel(unwanted)} is unwanted${source}. Amber means Want share minus half unwanted share is zero or below, using unrounded shares.`;
    if (compact) return <span title={explanation} className="whitespace-nowrap"><b className={`${color} text-sm`}>{shareLabel(want)}</b> {onlyYou ? label : label === "For you" ? "you" : "them"}</span>;
    return <div title={explanation} className={label === "For them" ? "mt-2" : undefined}>
      <span className={`${color} ${label === "For you" ? "text-2xl" : "text-base"} font-extrabold`}>{shareLabel(want)}</span>{" "}
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="mt-1 block text-xs font-normal text-slate-500">{shareLabel(unwanted)} unwanted</span>
    </div>;
  }
  return <div className={`shrink-0 text-right leading-none ${compact ? "flex flex-wrap justify-end gap-x-1 text-xs text-slate-500" : "whitespace-nowrap"}`}>
    {direction("For you", you, context?.you_unwanted_pct, context?.you_utility, matchSourceLabel(context?.you_source), context?.you_voted)}
    {!onlyYou && <>{compact && <span>·</span>}{direction("For them", they, context?.they_unwanted_pct, context?.they_utility, matchSourceLabel(context?.they_source), context?.they_voted)}</>}
  </div>;
}
