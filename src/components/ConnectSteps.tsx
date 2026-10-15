"use client";

import { useState, useTransition } from "react";
import { addFriend, cancelPending, markPending } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

type Step = "idle" | "pending" | "added";

/**
 * Add friend for players you don't know yet (Find New, pending list on My
 * Friends). Befriending happens in Pokémon Sleep, so the first tap only marks
 * them pending; once they accept in the game, a second tap adds them here
 * (or they join your list by themselves if they add you here first).
 * Cancel drops a request that fell through. Pending is saved to your account.
 */
export function ConnectSteps({ userId, name, initialPending = false }: { userId: string; name: string; initialPending?: boolean }) {
  const [step, setStep] = useState<Step>(initialPending ? "pending" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>, next: Step) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else setStep(next);
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  if (step === "added") return <p className="text-sm font-semibold text-want">✓ Added to your friends</p>;

  return (
    <div className="space-y-1.5">
      {step === "idle" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => markPending(userId), "pending")}
            className="rounded-lg bg-want px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add friend
          </button>
          <p className="text-xs text-slate-500">
            Send {name} a friend request in Pokémon Sleep with the friend code above, then tap Add friend.
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => addFriend(userId), "added")}
            className="rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-1.5 text-left text-sm font-semibold text-amber-900 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-100"
          >
            ⏳ Request pending · tap once you&apos;re friends in-game
          </button>
          <p className="text-xs text-slate-500">
            Didn&apos;t work out?{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => cancelPending(userId), "idle")}
              className="font-semibold underline disabled:opacity-50"
            >
              Cancel request
            </button>
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-dont">
          {error}
        </p>
      )}
    </div>
  );
}
