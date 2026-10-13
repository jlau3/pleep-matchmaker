import { LOW_FIT_PCT } from "@/lib/fit";

/**
 * How well a player fits your friends' wants, shown top right of their card on
 * My Friends. Counts their wants and their don't-wants against what your
 * friends want. Low fits get a quiet amber "low fit" instead of the green "fit".
 * Nothing when unknown.
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

const FIT_ROWS = [
  {
    key: "they",
    label: "fits your list",
    title: "How closely their wants and don't-wants line up with what your friends want: what you'd send them",
  },
  {
    key: "you",
    label: "you fit theirs",
    title: "How much of what you want their friends want: what they'd send you",
  },
] as const;

/**
 * Both fits for someone you could add (Find New Friends, search): how well
 * they fit your list, and how well you fit theirs. Low fits turn amber.
 */
export function FitPair({ they, you }: { they: number | null | undefined; you: number | null | undefined }) {
  const values = { they, you };
  if (values.they == null && values.you == null) return null;
  return (
    <div className="shrink-0 space-y-1 whitespace-nowrap text-right leading-none">
      {FIT_ROWS.map((row) => {
        const pct = values[row.key];
        const low = pct != null && pct < LOW_FIT_PCT;
        return (
          <div key={row.key} title={row.title}>
            <span className={`text-lg font-bold ${pct == null ? "text-slate-400" : low ? "text-amber-600 dark:text-amber-400" : "text-want"}`}>
              {pct == null ? "–" : `${pct}%`}
            </span>{" "}
            <span className={`text-xs ${low ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}
