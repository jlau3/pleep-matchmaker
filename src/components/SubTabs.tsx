import Link from "next/link";

/** Pill switch between the pages that share one top-level tab. */
export function SubTabs({ tabs, active }: { tabs: { href: string; label: string }[]; active: string }) {
  return (
    <nav className="mb-4 inline-flex rounded-full bg-white p-1 shadow-sm dark:bg-night">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            tab.href === active
              ? "pill-active"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export const FRIENDS_TABS = [
  { href: "/friends", label: "My friends" },
  { href: "/matches", label: "Find new" },
];

export const PROFILE_TABS = [
  { href: "/vote", label: "My votes" },
  { href: "/profile", label: "Settings" },
];
