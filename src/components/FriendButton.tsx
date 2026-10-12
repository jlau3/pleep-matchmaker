"use client";

import { useState, useTransition } from "react";
import { addFriend, removeFriend } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

/**
 * Add / remove friend. Removing asks "Are you sure?" inline first (native
 * confirm() is suppressed in some in-app browsers, e.g. Discord's).
 */
export function FriendButton({ userId, isFriend, name }: { userId: string; isFriend: boolean; name?: string }) {
  const [friend, setFriend] = useState(isFriend);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        const result = friend ? await removeFriend(userId) : await addFriend(userId);
        if (result.error) setError(result.error);
        else setFriend(!friend);
        setConfirming(false);
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  if (confirming) {
    return (
      <span role="alertdialog" aria-label="Remove friend?" className="inline-flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Remove {name ?? "this friend"}?</span>
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className="rounded-lg bg-dont px-3 py-1 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button
          type="button"
          disabled={pending}
          autoFocus
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-slate-300 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
        >
          Cancel
        </button>
        {error && (
          <span role="alert" className="text-xs text-dont">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!friend) return toggle();
          setError(null);
          setConfirming(true);
        }}
        className={`rounded-lg px-3 py-1 text-sm font-semibold disabled:opacity-50 ${
          friend
            ? "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
            : "bg-want text-white"
        }`}
      >
        {friend ? "Remove friend" : "Add friend"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-dont">
          {error}
        </span>
      )}
    </span>
  );
}
