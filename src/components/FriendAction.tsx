"use client";

import { useState, useTransition } from "react";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/app/actions";
import type { Relation } from "@/lib/relations";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

const solid = "rounded-lg bg-want px-3 py-1 text-sm font-semibold text-white disabled:opacity-50";
const outline =
  "rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300";
const link = "font-semibold underline disabled:opacity-50";

/**
 * The friend button on every player card, for each step of the handshake:
 * Send request → Request sent (Cancel) → they Accept or Decline (you see a
 * decline and can clear it) → Remove friend. Sending also means sending a
 * request in Pokémon Sleep, so when their code is showing it says so; a
 * closed player's code stays hidden, and they usually know you already.
 * Removing asks inline first (native confirm() is suppressed in some in-app
 * browsers, e.g. Discord's), including whether they stopped playing, which
 * feeds the inactive reports Find New uses.
 */
export function FriendAction({
  userId,
  name,
  relation: initial,
  showsCode = false,
  placeholder,
}: {
  userId: string;
  name: string;
  relation: Relation;
  /** Their friend code is on the card, so "also send a request in Pokémon Sleep" makes sense. */
  showsCode?: boolean;
  /** Not here yet name this player was found from: sending or accepting clears it. */
  placeholder?: string;
}) {
  // "declined-them": you just declined their request; nothing more to offer on this card.
  const [relation, setRelation] = useState<Relation | "declined-them">(initial);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run(
    action: () => Promise<{ error?: string; status?: string }>,
    next: (status?: string) => Relation | "declined-them",
    done?: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) return setError(result.error);
        const to = next(result.status);
        setRelation(to);
        setNote(to === "friend" && result.status === "friends" ? `They'd asked you too: you're friends now.` : (done ?? null));
        setConfirming(false);
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  const errorLine = error && (
    <span role="alert" className="text-xs text-dont">
      {error}
    </span>
  );

  if (relation === "friend" && confirming)
    return (
      <span role="alertdialog" aria-label="Remove friend?" className="inline-flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">
          Remove {name}? You&apos;ll come off their list too, like in Pokémon Sleep. Have they stopped playing?
        </span>
        <button type="button" disabled={busy} onClick={() => run(() => removeFriend(userId, true), () => "none")} className="rounded-lg bg-dont px-3 py-1 font-semibold text-white disabled:opacity-50">
          {busy ? "Removing…" : "Yes, inactive"}
        </button>
        <button type="button" disabled={busy} onClick={() => run(() => removeFriend(userId, false), () => "none")} className="rounded-lg bg-dont px-3 py-1 font-semibold text-white disabled:opacity-50">
          No, just remove
        </button>
        <button type="button" disabled={busy} autoFocus onClick={() => setConfirming(false)} className={outline}>
          Cancel
        </button>
        {errorLine}
      </span>
    );

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-2">
        {relation === "none" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => sendFriendRequest(userId, placeholder),
                (status) => (status === "friends" ? "friend" : "sent"),
                showsCode ? `Also send ${name} a friend request in Pokémon Sleep with the code above.` : undefined,
              )
            }
            className={solid}
          >
            {busy ? "Sending…" : "Send friend request"}
          </button>
        )}

        {relation === "sent" && (
          <>
            <span className="rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-0.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              ⏳ Request sent
            </span>
            <button type="button" disabled={busy} onClick={() => run(() => cancelFriendRequest(userId), () => "none")} className={`text-sm ${link}`}>
              Cancel
            </button>
          </>
        )}

        {relation === "declined" && (
          <>
            <span className="text-sm text-slate-500">{name} declined your request.</span>
            <button type="button" disabled={busy} onClick={() => run(() => cancelFriendRequest(userId), () => "none")} className={outline}>
              OK
            </button>
          </>
        )}

        {relation === "incoming" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => acceptFriendRequest(userId, placeholder),
                  () => "friend",
                  `You're friends now. Accept ${name}'s request in Pokémon Sleep too.`,
                )
              }
              className={solid}
            >
              {busy ? "Accepting…" : "Accept"}
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => declineFriendRequest(userId), () => "declined-them")} className={outline}>
              Decline
            </button>
          </>
        )}

        {relation === "declined-them" && <span className="text-sm text-slate-500">Declined.</span>}

        {relation === "friend" && (
          <button type="button" disabled={busy} onClick={() => (setError(null), setConfirming(true))} className={outline}>
            Remove friend
          </button>
        )}
        {errorLine}
      </span>
      {note && <span className="text-xs font-semibold text-want">{note}</span>}
    </span>
  );
}
