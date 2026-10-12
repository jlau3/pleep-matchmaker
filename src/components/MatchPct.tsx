/** Your match % with a player, shown top right of their card. Nothing when unknown. */
export function MatchPct({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  return (
    <div className="shrink-0 text-right leading-none">
      <div className="text-2xl font-bold text-want">{pct}%</div>
      <div className="text-xs text-slate-500">match</div>
    </div>
  );
}
