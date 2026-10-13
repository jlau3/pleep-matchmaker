/**
 * Placeholder shown the moment you navigate (Next's loading.tsx), while the
 * page's data loads, so taps feel instant instead of frozen.
 */
export function PageSkeleton({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  const bar = "animate-pulse rounded-full bg-slate-300/50 dark:bg-slate-600/40";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {title && <div className={`${bar} h-7 w-40`} />}
      <div className="flex gap-2">
        <div className={`${bar} h-8 w-24`} />
        <div className={`${bar} h-8 w-24`} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className={`${bar} h-5 w-1/3`} />
          <div className={`${bar} h-4 w-2/3`} />
          <div className={`${bar} h-4 w-1/2`} />
        </div>
      ))}
    </div>
  );
}
