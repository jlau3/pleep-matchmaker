/**
 * Sparkles for the night header, drawn only in the empty stretch of the nav
 * between the ? button and the right-hand icons, so they never touch text or
 * pills. Each star keeps a 10px margin from both ends; the narrower the gap,
 * the fewer stars (container queries), and on a crowded phone nav there are none.
 */
const STARS: { x: number; y: number; size: number; opacity: number; show: string }[] = [
  { x: 0.5, y: 22, size: 9, opacity: 0.85, show: "hidden @[36px]:block" },
  { x: 0.15, y: 62, size: 6, opacity: 0.7, show: "hidden @[70px]:block" },
  { x: 0.85, y: 66, size: 7, opacity: 0.75, show: "hidden @[70px]:block" },
  { x: 0.32, y: 18, size: 6, opacity: 0.65, show: "hidden @[140px]:block" },
  { x: 0.68, y: 30, size: 10, opacity: 0.9, show: "hidden @[140px]:block" },
  { x: 0.05, y: 30, size: 7, opacity: 0.8, show: "hidden @[260px]:block" },
  { x: 0.42, y: 72, size: 6, opacity: 0.65, show: "hidden @[260px]:block" },
  { x: 0.95, y: 20, size: 6, opacity: 0.7, show: "hidden @[260px]:block" },
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
