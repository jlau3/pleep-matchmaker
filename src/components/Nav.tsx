import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 header-night text-white shadow-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm">
        <Link href="/" className="shrink-0" aria-label="Pleep Matchmaker home">
          <img src="/logo.png" alt="Pleep Matchmaker" className="h-8 w-8" />
        </Link>
        {user && <NavLinks />}
        <Link
          href="/about"
          aria-label="How it works"
          title="How it works"
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 font-bold text-white/80 hover:bg-white/15 hover:text-white"
        >
          ?
        </Link>
      </nav>
    </header>
  );
}
