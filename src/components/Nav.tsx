import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const LINKS = [
  { href: "/friends", label: "Friends" },
  { href: "/pick", label: "Sort" },
  { href: "/collection", label: "My list" },
  { href: "/matches", label: "Find friends" },
  { href: "/lookup", label: "Look up" },
  { href: "/popular", label: "Popular" },
  { href: "/profile", label: "Profile" },
];

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-3 text-sm">
        <Link href="/" className="shrink-0 font-bold">
          Pleep Matchmaker
        </Link>
        {user &&
          LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              {link.label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
