"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const LINKS = [
  { href: "/tiers", label: "Tier List", match: ["/tiers"] },
  { href: "/friends", label: "Friends", match: ["/friends", "/matches"] },
  { href: "/vote", label: "Profile", match: ["/vote", "/profile"] },
  { href: "/guides", label: "Guides", match: ["/guides"] },
];

/**
 * The most-used tabs, loaded in the background so the first tap on each is
 * instant. The rest (Find New is the heaviest page) load when tapped: loading
 * every tab on every visit multiplied server work for pages most visits never open.
 */
const PREFETCH = ["/tiers", "/friends"];

export function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();

  // As soon as the page you landed on is interactive (effects run after
  // hydration), fetch those tabs fully, data included. The browser keeps
  // them for the visit (staleTimes in next.config.ts), so they aren't
  // recomputed when you switch back and forth. Only on the first page of the
  // visit; later pages are already cached.
  useEffect(() => {
    for (const href of PREFETCH) if (!pathname.startsWith(href)) router.prefetch(href);
  }, []);

  return (
    <>
      {LINKS.map((link) => {
        const active = link.match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 ${
              active
                ? "rounded-full bg-white/15 px-2 py-1 font-bold text-white sm:px-3"
                : "px-2 py-1 text-white/75 hover:text-white sm:px-3"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
