"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markHelpSeen } from "@/app/actions";
import { HELP_COOKIE } from "@/lib/help";
import { HowItWorks } from "./HowItWorks";

/**
 * The ? in the nav, and the How it works popup it opens over the current page
 * (a native <dialog>: darkened backdrop, Esc or a click outside closes it).
 * `autoOpen` opens it by itself, for a player who hasn't seen this
 * HELP_VERSION; closing it records that on their account. That first time it
 * ends with "Let's get set up", into the setup checklist (SetupChecklist).
 */
export function HelpModal({
  signedIn,
  autoOpen,
  rememberSeen,
}: {
  signedIn: boolean;
  autoOpen: boolean;
  /** Cookie value to store when the account has already seen this version (see HELP_COOKIE). */
  rememberSeen: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingSeen = useRef(autoOpen);
  const [welcome, setWelcome] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) {
      pendingSeen.current = true;
      setWelcome(true);
      dialog.current?.showModal();
    }
    // Already seen, but this browser hasn't cached that yet: skip the lookup next time.
    else if (rememberSeen) document.cookie = `${HELP_COOKIE}=${rememberSeen}; path=/; max-age=31536000; samesite=lax`;
  }, [autoOpen, rememberSeen]);

  function onClose() {
    setWelcome(false);
    if (!pendingSeen.current) return;
    pendingSeen.current = false;
    void markHelpSeen().catch(() => {});
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label="How it works"
        title="How it works"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 font-bold text-white/80 hover:bg-white/15 hover:text-white"
      >
        ?
      </button>
      <dialog
        ref={dialog}
        onClose={onClose}
        // A click on the backdrop lands on the <dialog> itself; following a link inside closes it too.
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) dialog.current?.close();
        }}
        aria-labelledby="help-title"
        className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
      >
        <div className="p-6">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h2 id="help-title" className="text-2xl font-extrabold">
              {welcome ? "Welcome to Pleep Matchmaker" : "How Pleep Matchmaker Works"}
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              ×
            </button>
          </div>
          {welcome ? (
            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p>Know which candy to send your Pokémon Sleep friends, and help them send the candy you want.</p>
              <ol className="space-y-3">
                <li><strong className="text-ink dark:text-white">1. Make yourself recognizable.</strong> Add your in-game name and icon.</li>
                <li><strong className="text-ink dark:text-white">2. Pick the candy you want.</strong> Everything else can stay Neutral.</li>
                <li><strong className="text-ink dark:text-white">3. Add your in-game friends.</strong> Their votes build your candy Tier List.</li>
              </ol>
              <p>You can take it one step at a time. The setup card will guide you, and help is always in the ? menu.</p>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">A candy wishlist for Pokémon Sleep players and their friends.</p>
              <HowItWorks links={signedIn} />
            </>
          )}
          {welcome ? (
            // First sign-in: lead into the setup checklist, starting with Profile.
            <div className="mt-6 space-y-2 text-center">
              <Link href="/profile?setup=profile" className="btn-primary block w-full py-2">
                Set up my profile →
              </Link>
            </div>
          ) : (
            <button type="button" onClick={() => dialog.current?.close()} className="btn-primary mt-6 w-full py-2">
              Got it
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
