"use client";

import { useEffect, useState } from "react";
import { InviteButton } from "./InviteButton";

const KEY = "pm_invite_reminder_hidden_at";
const HIDE_FOR_MS = 14 * 24 * 3600 * 1000;

/**
 * "Any Pokémon Sleep friends not on here yet?" with the invite button.
 * Dismissing hides it in this browser for two weeks, then it comes back.
 */
export function InviteReminder({ friendCount }: { friendCount: number }) {
  // Start hidden so a dismissed reminder never flashes before storage is read.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY));
      setHidden(Boolean(at) && Date.now() - at < HIDE_FOR_MS);
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Not remembered; it shows again next visit.
    }
  }

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sun/25 py-3 pl-4 pr-10 text-sm">
      <span>
        {friendCount > 0 ? (
          <>
            <strong>
              {friendCount} {friendCount === 1 ? "friend" : "friends"}
            </strong>{" "}
            on here so far. Any Pokémon Sleep friends who haven&apos;t signed up? Invite them so you can see everyone&apos;s
            priorities.
          </>
        ) : (
          <>Any Pokémon Sleep friends who haven&apos;t signed up? Invite them so you can see everyone&apos;s priorities.</>
        )}
      </span>
      <InviteButton />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide for now"
        title="Hide for now"
        className="absolute right-2 top-2 rounded-full px-2 text-lg leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
