"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Send feedback" with the current page attached, so reports say where they came from. */
export function FeedbackLink() {
  const pathname = usePathname();
  if (pathname === "/feedback") return null;
  return (
    <Link href={`/feedback?from=${encodeURIComponent(pathname)}`} className="underline hover:text-slate-800 dark:hover:text-white">
      Send feedback
    </Link>
  );
}
