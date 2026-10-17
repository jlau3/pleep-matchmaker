import { cookies } from "next/headers";
import Link from "next/link";
import { PageHelpButton } from "./PageHelpButton";
import { MetaNoteModal } from "./MetaNoteModal";
import { NavExtras } from "./NavExtras";
import { SignInButton } from "./SignInSheet";
import { NavLinks } from "./NavLinks";
import { NavStars } from "./NavStars";
import { activeMetaPost, META_COOKIE, metaCookieValue } from "@/content/meta";
import { automaticPopup } from "@/lib/help";
import { LINES_BY_ID, lineSpriteUrl } from "@/lib/lines";
import { getAuth } from "@/lib/supabase/server";

type Popup = { autoOpen: boolean; rememberSeen: string | null };
const SHUT: Popup = { autoOpen: false, rememberSeen: null };

/** New-Pokémon announcements wait until setup is finished or dismissed. */
async function popupState(userId: string | null, metaId: string | null): Promise<Popup> {
  if (!userId || !metaId) return SHUT;
  const metaValue = metaCookieValue(metaId, userId);
  if ((await cookies()).get(META_COOKIE)?.value === metaValue) return SHUT;
  const { supabase } = await getAuth();
  const { data, error } = await supabase.from("profiles").select("meta_seen_id, setup_done").eq("id", userId).maybeSingle();
  if (error || !data) return SHUT;
  const metaSeen = data.meta_seen_id === metaId;
  return {
    autoOpen: automaticPopup({ metaSeen, setupDone: data.setup_done === true }) === "meta",
    rememberSeen: metaSeen ? metaValue : null,
  };
}

export async function Nav() {
  const { userId } = await getAuth();
  const user = userId !== null;
  const note = activeMetaPost();
  const popup = await popupState(userId, note?.id ?? null);
  const noteLine = note?.lineId ? LINES_BY_ID.get(note.lineId) : undefined;

  return (
    <header data-site-header className="sticky top-0 z-20 header-night text-white shadow-md">
      <NavStars side="left" />
      <NavStars side="right" />
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-sm sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="Pleep Matchmaker home">
          <img src="/logo.png" alt="Pleep Matchmaker" className="h-8 w-8" />
        </Link>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-4">
          <NavLinks signedIn={user} />
        </div>
        <NavStars />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <PageHelpButton />
          {user ? <NavExtras donateUrl={process.env.NEXT_PUBLIC_DONATION_URL} /> : <SignInButton />}
        </div>
      </nav>
      {note && (popup.autoOpen || popup.rememberSeen) && (
        <MetaNoteModal
          postId={note.id}
          title={note.title}
          sprite={noteLine ? lineSpriteUrl(noteLine) : null}
          autoOpen={popup.autoOpen}
          rememberSeen={popup.rememberSeen}
        >
          {note.body}
        </MetaNoteModal>
      )}
    </header>
  );
}
