import { cookies } from "next/headers";
import Link from "next/link";
import { HelpModal } from "./HelpModal";
import { NavLinks } from "./NavLinks";
import { HELP_COOKIE, HELP_VERSION, helpCookieValue } from "@/lib/help";
import { getAuth } from "@/lib/supabase/server";

/**
 * Whether the How it works popup should open by itself: signed in and this
 * account hasn't seen HELP_VERSION. The cookie skips the lookup once seen; if
 * the lookup fails (e.g. the help_seen migration hasn't run), it stays shut.
 */
async function helpState(userId: string | null) {
  if (!userId) return { autoOpen: false, rememberSeen: null };
  const seenValue = helpCookieValue(userId);
  if ((await cookies()).get(HELP_COOKIE)?.value === seenValue) return { autoOpen: false, rememberSeen: null };
  const { supabase } = await getAuth();
  const { data, error } = await supabase.from("profiles").select("help_seen_version").eq("id", userId).maybeSingle();
  if (error || !data) return { autoOpen: false, rememberSeen: null };
  const seen = (data.help_seen_version as number) >= HELP_VERSION;
  return { autoOpen: !seen, rememberSeen: seen ? seenValue : null };
}

export async function Nav() {
  const { userId } = await getAuth();
  const user = userId !== null;
  const help = await helpState(userId);

  return (
    <header className="sticky top-0 z-20 header-night text-white shadow-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm">
        <Link href="/" className="shrink-0" aria-label="Pleep Matchmaker home">
          <img src="/logo.png" alt="Pleep Matchmaker" className="h-8 w-8" />
        </Link>
        {user && <NavLinks />}
        <HelpModal signedIn={user} autoOpen={help.autoOpen} rememberSeen={help.rememberSeen} />
      </nav>
    </header>
  );
}
