"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/tiers", label: "Tier list", match: ["/tiers"] },
  { href: "/friends", label: "Friends", match: ["/friends", "/matches"] },
  { href: "/vote", label: "Profile", match: ["/vote", "/profile"] },
];

export function NavLinks() {
  const pathname = usePathname();
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
                ? "font-semibold text-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
