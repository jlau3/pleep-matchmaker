"use client";

import { useState, useTransition } from "react";
import { blockUser, unblockUser } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

/**
 * Block / unblock a player. Blocking asks first with an inline prompt (native
 * confirm() is suppressed in some in-app browsers, e.g. Discord's), then
 * offers Unblock in place. Settings lists everyone you've blocked with the
 * same Unblock button.
 */
export function BlockButton({ userId, name, blocked: initiallyBlocked = false }: { userId: string; name: string; blocked?: boolean }) {
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>, nextBlocked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else {
          setBlocked(nextBlocked);
          setConfirming(false);
        }
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  const link = "text-xs underline disabled:opacity-50";
  const errorText = error && (
    <span role="alert" className="text-xs text-dont">
      {error}
    </span>
  );

  if (blocked) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-dont">Blocked</span>
        <button type="button" disabled={pending} onClick={() => run(() => unblockUser(userId), false)} className={`${link} text-slate-600 dark:text-slate-300`}>
          {pending ? "Unblocking…" : "Unblock"}
        </button>
        {errorText}
      </span>
    );
  }

  if (confirming) {
    return (
      <span role="alertdialog" aria-label={`Block ${name}?`} className="inline-flex flex-wrap items-center gap-2 text-xs">
        <span>
          Block <strong>{name}</strong>? You&apos;ll stop seeing each other in matches, lookups and friend lists.
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => blockUser(userId), true)}
          className="rounded-lg bg-dont px-2 py-0.5 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Blocking…" : "Yes, block"}
        </button>
        <button type="button" disabled={pending} autoFocus onClick={() => setConfirming(false)} className={link}>
          Cancel
        </button>
        {errorText}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => setConfirming(true)} className={`${link} text-slate-500 hover:text-dont`}>
        Block
      </button>
      {errorText}
    </span>
  );
}
