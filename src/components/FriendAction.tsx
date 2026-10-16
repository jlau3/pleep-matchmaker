"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  removePlaceholder,
  sendFriendRequest,
} from "@/app/actions";
import { PROFILE_INCOMPLETE, type Relation } from "@/lib/relations";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

const solid = "rounded-lg bg-want px-3 py-1 text-sm font-semibold text-white disabled:opacity-50";
const outline =
  "rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300";
const link = "font-semibold underline disabled:opacity-50";

/**
 * The friend button on every player card, for each step of the handshake:
 * Send request → Request sent (Cancel) → they Accept or Decline (you see a
 * decline and can clear it; one left unanswered for 30 days shows as expired,
 * to send again or clear) → Remove friend. Sending also means sending a
 * request in Pokémon Sleep: codes travel only with requests (20261021000900),
 * so yours goes to them and they add you in-game; once you're friends the
 * codes are gone, as in the game.
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
  /** Their friend code is on the card. On a request to you, missing means they sent it as "already friends in the game". */
  showsCode?: boolean;
  /** Not here yet name this player was found from: after sending or accepting, asks whether to remove it. */
  placeholder?: string;
}) {
  // "declined-them": you just declined their request; nothing more to offer on this card.
  const [relation, setRelation] = useState<Relation | "declined-them">(initial);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The Not here yet name to offer removing, once a request or accept to them went through.
  const [askRemove, setAskRemove] = useState<string | null>(null);
  // "We're already friends in Pokémon Sleep": send the request without your friend code.
  const [inGame, setInGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

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
        // The page refresh waits for the answer (deferRefresh), so this card stays to ask it.
        if (placeholder && (to === "sent" || to === "friend")) setAskRemove(placeholder);
      } catch (e) {
        rethrowIfNavigation(e);
        setError(SAVE_FAILED);
      }
    });
  }

  const errorLine = error && (
    <span role="alert" className="text-xs text-dont">
      {error}
      {error === PROFILE_INCOMPLETE && (
        <>
          {" "}
          <Link href="/profile" className="font-semibold underline">
            Go to Profile
          </Link>
        </>
      )}
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
                () => sendFriendRequest(userId, Boolean(placeholder), !inGame),
                (status) => (status === "friends" ? "friend" : "sent"),
                inGame
                  ? `Sent without your friend code, since you're already friends in Pokémon Sleep.`
                  : `${name} gets your friend code with the request, to add you in Pokémon Sleep when they accept.`,
              )
            }
            className={solid}
          >
            {busy ? "Sending…" : "Send friend request"}
          </button>
        )}
        {relation === "none" && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={inGame} onChange={(e) => setInGame(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-night)]" />
            Already friends in Pokémon Sleep (send without my code)
          </label>
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

        {relation === "setup" && (
          <span className="text-sm text-slate-600 dark:text-slate-300">
            To send friend requests,{" "}
            <Link href="/profile" className="font-semibold underline">
              add your in-game name, friend code, and icon
            </Link>{" "}
            so they know who&apos;s asking.
          </span>
        )}

        {relation === "expired" && (
          <>
            <span className="rounded-lg border-2 border-dashed border-slate-400 px-3 py-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              ⌛ Request expired
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => sendFriendRequest(userId, Boolean(placeholder)), (status) => (status === "friends" ? "friend" : "sent"))}
              className={solid}
            >
              {busy ? "Sending…" : "Send again"}
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => cancelFriendRequest(userId), () => "none")} className={outline}>
              Clear
            </button>
          </>
        )}

        {relation === "incoming" && (
          <>
            {!showsCode && <span className="w-full text-xs text-slate-500">{name} says you&apos;re already friends in Pokémon Sleep.</span>}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => acceptFriendRequest(userId, Boolean(placeholder)),
                  () => "friend",
                  showsCode
                    ? `You're friends now. Add ${name} in Pokémon Sleep too if you haven't yet.`
                    : `You're friends now.`,
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

        {relation === "incoming-setup" && (
          <>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              To accept,{" "}
              <Link href="/profile" className="font-semibold underline">
                add your in-game name, friend code, and icon
              </Link>{" "}
              so they can add you in Pokémon Sleep.
            </span>
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
      {askRemove && (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-sun/30 px-2 py-1 text-xs dark:bg-sun/15">
          <span>
            Take <b>{askRemove}</b> off your Friends to Find list?
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const name = askRemove;
              startTransition(async () => {
                try {
                  const result = await removePlaceholder(name);
                  if (result.error) return setError(result.error);
                  setAskRemove(null);
                  router.refresh();
                } catch (e) {
                  rethrowIfNavigation(e);
                  setError(SAVE_FAILED);
                }
              });
            }}
            className="font-semibold underline disabled:opacity-50"
          >
            Remove
          </button>
          <button type="button" disabled={busy} onClick={() => (setAskRemove(null), router.refresh())} className="font-semibold underline disabled:opacity-50">
            Keep it
          </button>
        </span>
      )}
    </span>
  );
}
