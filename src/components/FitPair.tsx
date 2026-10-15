import { LOW_FIT_PCT } from "@/lib/fit";

const color = (pct: number | null | undefined) =>
  pct == null ? "text-slate-500" : pct < LOW_FIT_PCT ? "text-amber-600 dark:text-amber-400" : "text-want";

/**
 * Both fits, top right of a player's card (My Friends, Find New Friends,
 * search). "For you" (big, on top): how much of what you want their friends
 * want, so the candy they send suits you. "For them" (smaller, below): how
 * well their wants match your friends', so the candy you send suits them.
 * Either turns amber below LOW_FIT_PCT, so a lopsided friendship stands out.
 * A missing one shows a dash (not enough votes yet; see FitLegend).
 */
export function FitPair({
  they,
  you,
  compact = false,
}: {
  they: number | null | undefined;
  you: number | null | undefined;
  /** One small line, for grid tiles. */
  compact?: boolean;
}) {
  const low = (pct: number | null | undefined) => pct != null && pct < LOW_FIT_PCT;
  const pct = (n: number | null | undefined) => (n == null ? "–" : `${n}%`);
  if (compact)
    return (
      <span className="whitespace-nowrap text-xs font-semibold text-slate-500">
        <b className={`text-sm ${color(you)}`} title="For you">{pct(you)}</b> you ·{" "}
        <b className={`text-sm ${color(they)}`} title="For them">{pct(they)}</b> them
      </span>
    );
  return (
    <div className="shrink-0 whitespace-nowrap text-right leading-none">
      <div title="For you: how much of what you want their friends want, so the candy they send suits you">
        <span className={`text-2xl font-extrabold ${color(you)}`}>{you == null ? "–" : `${you}%`}</span>{" "}
        <span className={`text-sm font-semibold ${low(you) ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
          for you
        </span>
      </div>
      <div className="mt-1" title="For them: how well their wants match what your friends want, so the candy you send suits them">
        <span className={`text-base font-bold ${color(they)}`}>{they == null ? "–" : `${they}%`}</span>{" "}
        <span className={`text-xs font-semibold ${low(they) ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>
          for them
        </span>
      </div>
    </div>
  );
}
