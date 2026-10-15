"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 text-white/80 hover:bg-white/15 hover:text-white";

/**
 * Feedback (with the current page attached) and, once NEXT_PUBLIC_DONATION_URL
 * is set, a small support link: icons at the right of the nav, so they're
 * findable without shouting.
 */
export function NavExtras({ donateUrl }: { donateUrl?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {pathname !== "/feedback" && (
        <Link href={`/feedback?from=${encodeURIComponent(pathname)}`} aria-label="Send feedback" title="Send feedback" className={icon}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-3.6 3.1A.75.75 0 0 1 4.2 15.5V13A2.5 2.5 0 0 1 3 10.5z" />
          </svg>
        </Link>
      )}
      {donateUrl && (
        <a href={donateUrl} target="_blank" rel="noopener noreferrer" aria-label="Support the site" title="Enjoying it? Help with server costs" className={icon}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M10 17.3 8.9 16.3C4.6 12.5 2 10.1 2 7.2 2 4.9 3.8 3 6.1 3c1.3 0 2.6.6 3.4 1.6h1C11.3 3.6 12.6 3 13.9 3 16.2 3 18 4.9 18 7.2c0 2.9-2.6 5.3-6.9 9.1z" />
          </svg>
        </a>
      )}
    </div>
  );
}
