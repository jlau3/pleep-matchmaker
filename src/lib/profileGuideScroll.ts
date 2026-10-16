/** Smallest scroll that reveals the controls and leaves room for the guide card. */
export function profileGuideScroll(
  target: { top: number; bottom: number },
  cardHeight: number,
  viewport: { top: number; height: number },
  scrollY: number,
): number {
  const top = viewport.top + 16;
  const bottom = viewport.top + viewport.height - 16;
  const height = target.bottom - target.top;
  // Reveal an off-screen step without centering controls that are already visible.
  let scroll = target.top < top ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
  if (height > bottom - top) scroll = target.top - top;
  const above = target.top - scroll - cardHeight - 20 - top;
  const below = target.bottom - scroll + cardHeight + 20 - bottom;
  if (above >= 0 || below <= 0 || height + cardHeight + 20 > bottom - top) return scroll;
  // Both placements need some space. Prefer the nearer one, accounting for the
  // top of the document so an impossible upward scroll doesn't hide the card.
  const up = scroll + above;
  const down = scroll + below;
  return up >= -scrollY && Math.abs(up) < Math.abs(down) ? up : down;
}
