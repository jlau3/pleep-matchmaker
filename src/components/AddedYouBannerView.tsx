"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The banner itself; hidden on My Friends, where the Added you list is. */
export function AddedYouBannerView({ names }: { names: string[] }) {
  const pathname = usePathname();
  if (pathname.startsWith("/friends")) return null;
  const who =
    names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-3">
      <Link
        href="/friends#added-you"
        className="flex items-center justify-between gap-3 rounded-2xl border border-sun-deep/40 bg-[#fff3c9] px-4 py-2 text-sm hover:brightness-[1.02] dark:bg-night"
      >
        <span>
          🤝 <strong>{who}</strong> added you as a friend. Add them back?
        </span>
        <span className="shrink-0 font-semibold underline">See who</span>
      </Link>
    </div>
  );
}
