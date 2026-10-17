/**
 * Sparkles for the night header, drawn only in the empty stretch of the nav
 * between the page tabs and the right-hand utility buttons, so they never touch text or
 * pills. Each star keeps a 10px margin from both ends; the narrower the gap,
 * the fewer stars (container queries), and on a crowded phone nav there are none.
 */
// Centered at small widths, then a staggered constellation as space opens up.
const STARS = [
  { x: 0.5, y: 50, size: 7, opacity: 0.7, show: "hidden @[56px]:block @[140px]:hidden" },
  ...[0.15, 0.5, 0.85].map((x, i) => ({ x, y: i % 2 ? 68 : 30, size: i === 1 ? 9 : 6,
    opacity: i === 1 ? 0.8 : 0.6, show: "hidden @[140px]:block @[320px]:hidden" })),
  ...[0.06, 0.2, 0.35, 0.5, 0.65, 0.8, 0.94].map((x, i) => ({ x, y: i % 2 ? 68 : 30,
    size: [6, 8, 6, 9, 7, 6, 8][i], opacity: i === 3 ? 0.8 : 0.6, show: "hidden @[320px]:block" })),
];

export function NavStars() {
  return (
    // -my-2 spans the nav's vertical padding, so y is measured over the whole header height.
    <span aria-hidden className="@container relative -my-2 min-w-0 flex-1 self-stretch">
      {STARS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 10 10"
          className={`absolute ${s.show}`}
          style={{
            left: `calc(10px + (100% - 20px - ${s.size}px) * ${s.x})`,
            top: `calc(${s.y}% - ${s.size / 2}px)`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
        >
          <path fill="#fff" d="M5 0C5.4 3.6 6.4 4.6 10 5C6.4 5.4 5.4 6.4 5 10C4.6 6.4 3.6 5.4 0 5C3.6 4.6 4.6 3.6 5 0Z" />
        </svg>
      ))}
    </span>
  );
}
