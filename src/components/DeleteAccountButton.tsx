"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

/**
 * Two-step delete: the first click opens an in-page "Are you sure?" panel.
 * Native confirm() is avoided because some in-app browsers (e.g. Discord's)
 * suppress it.
 */
export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border-2 border-dont px-4 py-2 font-semibold text-dont hover:bg-dont/10"
      >
        Delete account
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby="delete-title" className="w-full rounded-3xl border-2 border-dont bg-dont/5 p-4">
      <p id="delete-title" className="font-bold text-dont">
        Are you sure?
      </p>
      <p className="mt-1 text-sm">
        This permanently deletes your profile, all your votes and your friend list. It can&apos;t be undone.
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-dont">
          {SAVE_FAILED}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await deleteAccount();
              } catch (e) {
                rethrowIfNavigation(e);
                setFailed(true);
              }
            })
          }
          className="rounded-full bg-dont px-4 py-2 font-bold text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete my account"}
        </button>
        <button
          type="button"
          disabled={pending}
          autoFocus
          onClick={() => setConfirming(false)}
          className="rounded-full border-2 border-meh px-4 py-2 font-semibold disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
