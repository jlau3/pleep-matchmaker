import { LOW_FIT_PCT } from "@/lib/fit";

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
 * Both fits, top right of a player's card (My Friends, Find New Friends,
 * search): how well they fit your list, and how well you fit theirs. Either
 * one turns amber below LOW_FIT_PCT, so a lopsided friendship stands out.
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
