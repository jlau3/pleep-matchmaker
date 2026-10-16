import { cookies } from "next/headers";
import Link from "next/link";
import { HelpModal } from "./HelpModal";
import { MetaNoteModal } from "./MetaNoteModal";
import { NavExtras } from "./NavExtras";
import { SignInButton } from "./SignInSheet";
import { NavLinks } from "./NavLinks";
import { NavStars } from "./NavStars";
import { activeMetaPost, META_COOKIE, metaCookieValue } from "@/content/meta";
import { HELP_COOKIE, HELP_VERSION, helpCookieValue, automaticPopup } from "@/lib/help";
import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { getAuth } from "@/lib/supabase/server";

type Popup = { autoOpen: boolean; rememberSeen: string | null };
const SHUT: Popup = { autoOpen: false, rememberSeen: null };

/**
 * The welcome opens first; new-Pokémon notes wait until setup is finished or
 * skipped. Cookies skip the profile lookup once both are seen; if the lookup
 * fails (e.g. a migration hasn't run), both stay shut.
 */
async function popupState(userId: string | null, metaId: string | null): Promise<{ help: Popup; meta: Popup }> {
  if (!userId) return { help: SHUT, meta: SHUT };
  const jar = await cookies();
  const helpValue = helpCookieValue(userId);
  const metaValue = metaId ? metaCookieValue(metaId, userId) : null;
  const helpKnown = jar.get(HELP_COOKIE)?.value === helpValue;
  const metaKnown = !metaValue || jar.get(META_COOKIE)?.value === metaValue;
  if (helpKnown && metaKnown) return { help: SHUT, meta: SHUT };

  const columns = metaKnown ? "help_seen_version" : "help_seen_version, meta_seen_id, setup_done";
  const { supabase } = await getAuth();
  const { data, error } = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();
  if (error || !data) return { help: SHUT, meta: SHUT };
  const row = data as unknown as { help_seen_version: number; meta_seen_id?: string | null; setup_done?: boolean };

  const metaSeen = metaKnown || row.meta_seen_id === metaId;
  const helpSeen = helpKnown || row.help_seen_version >= HELP_VERSION;
  const popup = automaticPopup({ helpSeen, metaSeen, setupDone: row.setup_done === true });
  const meta: Popup = metaKnown ? SHUT : { autoOpen: popup === "meta", rememberSeen: metaSeen ? metaValue : null };
  const help: Popup = helpKnown ? SHUT : { autoOpen: popup === "help", rememberSeen: helpSeen ? helpValue : null };
  return { help, meta };
}

export async function Nav() {
  const { userId } = await getAuth();
  const user = userId !== null;
  const note = activeMetaPost();
  const popups = await popupState(userId, note?.id ?? null);
  const noteLine = note?.lineId ? LINES_BY_ID.get(note.lineId) : undefined;

  return (
    <header className="sticky top-0 z-20 header-night text-white shadow-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-sm sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="Pleep Matchmaker home">
          <img src="/logo.png" alt="Pleep Matchmaker" className="h-8 w-8" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-4">
          <NavLinks signedIn={user} />
        </div>
        <HelpModal signedIn={user} autoOpen={popups.help.autoOpen} rememberSeen={popups.help.rememberSeen} />
        {user && <NavStars />}
        {user ? <NavExtras donateUrl={process.env.NEXT_PUBLIC_DONATION_URL} /> : <SignInButton />}
      </nav>
      {note && (popups.meta.autoOpen || popups.meta.rememberSeen) && (
        <MetaNoteModal
          postId={note.id}
          title={note.title}
          sprite={noteLine ? lineSpriteUrl(noteLine) : null}
          autoOpen={popups.meta.autoOpen}
          rememberSeen={popups.meta.rememberSeen}
        >
          {note.body}
        </MetaNoteModal>
      )}
    </header>
  );
}
