import { missingMatchReason, type MatchContext } from "@/lib/matchContext";
import { LOW_FIT_PCT } from "@/lib/fit";

const color = (pct: number | null | undefined) =>
  pct == null ? "text-slate-500" : pct < LOW_FIT_PCT ? "text-amber-600 dark:text-amber-400" : "text-want";

/**
 * Both fits, top right of a player's card (My Friends, Find New Friends,
 * search). "For you" (big, on top): how much of what you want their friends
 * want, so the candy they send suits you. "For them" (smaller, below): how
 * well their wants match your friends', so the candy you send suits them.
 * Either turns amber below LOW_FIT_PCT, so a lopsided friendship stands out.
 * A missing one shows a dash with a reason; FitLegend provides on-demand help.
 */
export function FitPair({
  they,
  you,
  compact = false,
  context,
}: {
  they: number | null | undefined;
  you: number | null | undefined;
  context?: MatchContext;
  /** One small line, for grid tiles. */
  compact?: boolean;
}) {
  const youMissing = missingMatchReason("you", context?.you_voted);
  const theyMissing = missingMatchReason("them", context?.they_voted);
  const source = (direction: "you" | "they", value: number | null | undefined) => value != null && context?.[`${direction}_source`] ? (
    <span className="mt-0.5 block whitespace-normal text-[10px] font-normal leading-tight text-slate-500">{context[`${direction}_source`]}</span>
  ) : null;
  const low = (pct: number | null | undefined) => pct != null && pct < LOW_FIT_PCT;
  const pct = (n: number | null | undefined) => (n == null ? "–" : `${n}%`);
  if (compact)
    return (
      <span className="text-xs font-semibold text-slate-500">
        <span className="inline-block align-top">
        <b className={`text-sm ${color(you)}`} title={you == null ? youMissing : "For you"} aria-label={you == null ? youMissing : undefined}>{pct(you)}</b> you{source("you", you)}</span> ·{" "}
        <span className="inline-block align-top">
        <b className={`text-sm ${color(they)}`} title={they == null ? theyMissing : "For them"} aria-label={they == null ? theyMissing : undefined}>{pct(they)}</b> them{source("they", they)}</span>
      </span>
    );
  return (
    <div className="shrink-0 whitespace-nowrap text-right leading-none">
      <div title={you == null ? youMissing : "For you: how well the candy they'd send matches your votes"}>
        <span className={`text-2xl font-extrabold ${color(you)}`} aria-label={you == null ? youMissing : undefined}>{you == null ? "–" : `${you}%`}</span>{" "}
        <span className={`text-sm font-semibold ${low(you) ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
          For you
        </span>
        {source("you", you)}
      </div>
      <div className="mt-1" title={they == null ? theyMissing : "For them: how well the candy you'd send matches their votes"}>
        <span className={`text-base font-bold ${color(they)}`} aria-label={they == null ? theyMissing : undefined}>{they == null ? "–" : `${they}%`}</span>{" "}
        <span className={`text-xs font-semibold ${low(they) ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
          For them
        </span>
        {source("they", they)}
      </div>
    </div>
  );
}
