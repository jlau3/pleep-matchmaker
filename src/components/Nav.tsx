import { cookies } from "next/headers";
import Link from "next/link";
import { HelpModal } from "./HelpModal";
import { MetaNoteModal } from "./MetaNoteModal";
import { NavLinks } from "./NavLinks";
import { activeMetaPost, META_COOKIE, metaCookieValue } from "@/content/meta";
import { HELP_COOKIE, HELP_VERSION, helpCookieValue } from "@/lib/help";
import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { getAuth } from "@/lib/supabase/server";

type Popup = { autoOpen: boolean; rememberSeen: string | null };
const SHUT: Popup = { autoOpen: false, rememberSeen: null };

/**
 * Which popups open by themselves for a signed-in player: the active
 * new-Pokémon note (src/content/meta.tsx) if they haven't closed it, else How
 * it works if they haven't seen this HELP_VERSION (it then waits for the next
 * page). Cookies skip the profile lookup once both are seen; if the lookup
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

  const columns = metaKnown ? "help_seen_version" : "help_seen_version, meta_seen_id";
  const { supabase } = await getAuth();
  const { data, error } = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();
  if (error || !data) return { help: SHUT, meta: SHUT };
  const row = data as unknown as { help_seen_version: number; meta_seen_id?: string | null };

  const metaSeen = metaKnown || row.meta_seen_id === metaId;
  const meta: Popup = metaKnown ? SHUT : { autoOpen: !metaSeen, rememberSeen: metaSeen ? metaValue : null };
  const helpSeen = helpKnown || row.help_seen_version >= HELP_VERSION;
  const help: Popup = helpKnown
    ? SHUT
    : // The note goes first; How it works waits until it's closed.
      { autoOpen: !helpSeen && !meta.autoOpen, rememberSeen: helpSeen ? helpValue : null };
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
      <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="Pleep Matchmaker home">
          <img src="/logo.png" alt="Pleep Matchmaker" className="h-8 w-8" />
        </Link>
        {user && <NavLinks />}
        <HelpModal signedIn={user} autoOpen={popups.help.autoOpen} rememberSeen={popups.help.rememberSeen} />
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
