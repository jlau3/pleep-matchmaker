"use client";

import { useState, useTransition } from "react";
import { addFriend } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

/**
 * For someone who added you and whose IGN matches a Not here yet name:
 * confirming adds them back and takes the name off the list.
 */
export function ConfirmPlaceholder({ userId, placeholder }: { userId: string; placeholder: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (done) return <span className="text-sm font-semibold text-want">✓ Added, and off your Not here yet list</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await addFriend(userId, placeholder);
              if (result.error) setError(result.error);
              else setDone(true);
            } catch (e) {
              rethrowIfNavigation(e);
              setError(SAVE_FAILED);
            }
          })
        }
        className="btn-primary px-4 py-1 text-sm"
      >
        {pending ? "Adding…" : "It's them, add back"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-dont">
          {error}
        </span>
      )}
    </span>
  );
}
