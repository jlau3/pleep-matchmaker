/**
 * One-line key for the two FitPair numbers, shown above lists of player cards.
 * `friendsVoted` false (none of your friends has voted yet) adds why "for
 * them" shows a dash and what to do about it.
 */
export function FitLegend({ friendsVoted = true, youVoted = true }: { friendsVoted?: boolean; youVoted?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-500">
        <b className="text-slate-700 dark:text-slate-200">For you</b>: How much of what you want aligns with what their
        friends want, so the candy they send suits you. <b className="text-slate-700 dark:text-slate-200">For them</b>:
        How much of what they want aligns with what your friends want too, so the candy you send suits them. A
        &ndash; means there isn&apos;t enough to go on yet.
      </p>
      {!youVoted && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          &ldquo;For you&rdquo; shows &ndash; until you vote on what you want.
        </p>
      )}
      {!friendsVoted && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          &ldquo;For them&rdquo; shows &ndash; until your friends here have voted, since it&apos;s based on what they
          want. Add your Pokémon Sleep friends (in the game first, then here) and ask them to vote.
        </p>
      )}
    </div>
  );
}
