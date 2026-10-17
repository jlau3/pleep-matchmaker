/** Trial utility uses exact, unrounded shares. Neutral contributes zero. */
export function candyUtility(want: number | null | undefined, unwanted: number | null | undefined): number | null {
  return want == null || unwanted == null ? null : want - 0.5 * unwanted;
}

export const shareLabel = (share: number | null | undefined): string => share == null ? "–" : `${Math.round(share)}%`;
