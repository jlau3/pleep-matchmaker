"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { enableLookup } from "@/app/actions";
import { formatFriendCode } from "@/lib/format";

const callout =
  "rounded-2xl border-2 border-dashed border-sun-deep/60 bg-[#fff3c9] p-4 text-sm dark:bg-night";

/**
 * A ready-to-paste "looking for friends" post for anywhere players gather
 * (Discord, Reddit, group chats): friend code, Top 3
 * (or a few wants), and a pointer to look you up here, where search shows how
 * well your wants fit the reader's friends.
 */
export function FriendPostCard({
  userId,
  friendCode,
  ign,
  allowLookup,
  topNames,
  wantNames,
}: {
  userId: string;
  friendCode: string | null;
  /** Your in-game name, so readers recognize you in Pokémon Sleep. */
  ign: string | null;
  /** With lookup off, search can't find you, so the post leaves the link out. */
  allowLookup: boolean;
  topNames: string[];
  wantNames: string[];
}) {
  const [origin, setOrigin] = useState("https://pleep-matchmaker.vercel.app");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [turningOn, startTurningOn] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const reopen = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const dismissed = useRef(false);
  const restored = useRef(false);
  const hiddenKey = `pm_friend_post_hidden:${userId}`;
  useEffect(() => {
    try { setHidden(localStorage.getItem(hiddenKey) === "1"); }
    catch { setHidden(false); }
  }, [hiddenKey]);
  useEffect(() => {
    if (hidden && dismissed.current) {
      reopen.current?.focus({ preventScroll: true });
      dismissed.current = false;
    }
    if (!hidden && restored.current) {
      card.current?.querySelector<HTMLElement>("summary, a")?.focus({ preventScroll: true });
      restored.current = false;
    }
  }, [hidden]);
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  if (hidden === null) return null;
  if (hidden) return (
    <button ref={reopen} type="button" onClick={() => {
      restored.current = true;
      setPostOpen(true);
      setHidden(false);
      try { localStorage.removeItem(hiddenKey); } catch { /* Storage is optional. */ }
    }} className="text-sm font-semibold text-slate-500 underline">
      Share a friend post
    </button>
  );
  const closeButton = (
    <button type="button" aria-label="Hide friend post" onClick={() => {
      dismissed.current = true;
      setHidden(true);
      try { localStorage.setItem(hiddenKey, "1"); } catch { /* Hidden for this visit. */ }
    }} className="absolute right-2 top-2 rounded-full px-2 text-xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white">
      ×
    </button>
  );

  if (!friendCode) {
    return (
      <section ref={card} className={`${callout} relative`}>
        {closeButton}
        <p className="pr-7 text-slate-700 dark:text-slate-300">
          <b>📣 Your friends here should match your Pokémon Sleep friends!</b> Send them a friend request here too, so your
          Tier List reflects the people you actually send candy to. Looking for more friends? Add your friend code in{" "}
          <Link href="/profile" className="underline">Profile → Settings</Link> to get a ready-made post.
        </p>
      </section>
    );
  }

  const favorites =
    topNames.length === 1
      ? `My top candy: ${topNames[0]}`
      : topNames.length > 1
        ? `My Top ${topNames.length} candies: ${topNames.join(", ")}`
        : wantNames.length > 0
          ? `Candies I'm after: ${wantNames.join(", ")}`
          : null;
  // The link opens Friends with your friend code already searched: unique, always set here, and
  // lookup matches it exactly (IGNs can be shared; Discord names can be hidden).
  const link = `${origin}/friends?q=${friendCode}`;
  const message = [
    "🍬 Looking for Pokémon Sleep friends! 🍬",
    // Code before IGN: pasted into the game's friend search, the first number in the post wins, and an IGN can have digits.
    `Friend code: ${formatFriendCode(friendCode)}`,
    ign ? `IGN: ${ign}` : null,
    favorites,
    allowLookup ? `See how my candy wishlist matches your friends' on Pleep Matchmaker: ${link}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  async function share() {
    try {
      await navigator.share({ text: message });
    } catch {
      // Canceled or unsupported here; Copy still works.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this post:", message);
    }
  }

  return (
    // A dashed gold call-out, collapsed by default, so it doesn't read as one of the player cards below.
    <section ref={card} className={`${callout} relative`}>
      {closeButton}
      <details className="group" open={postOpen} onToggle={(event) => setPostOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 pr-7">
          <span>
            <b>📣 Your friends here should match your Pokémon Sleep friends!</b>{" "}
            <span className="text-slate-700 dark:text-slate-300">
              Send them a friend request here too, so your Tier List reflects the people you actually send candy to. Looking
              for more friends? Share a post with your friend code below!
            </span>
            {!allowLookup && (
              <span className="ml-1 font-semibold text-amber-800 dark:text-amber-200">Lookup is off, so it won&apos;t link to you.</span>
            )}
          </span>
          <span className="shrink-0 text-xs font-semibold underline group-open:hidden">Show</span>
          <span className="hidden shrink-0 text-xs font-semibold underline group-open:inline">Hide</span>
        </summary>
        <div className="mb-2 mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">Paste it wherever you look for friends: Discord, Reddit, group chats.</p>
          <div className="flex shrink-0 gap-2">
            {canShare && (
              <button type="button" onClick={share} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-600">
                Share
              </button>
            )}
            <button type="button" onClick={copy} className="btn-primary px-4 py-1.5 text-sm">
              {copied ? "Copied!" : "Copy post"}
            </button>
          </div>
        </div>
        {!allowLookup && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <span>
              &quot;Allow lookup&quot; is off, so readers can&apos;t find you here and the post leaves out your link. Planning to
              share it? Turn lookup back on.
            </span>
            <button
              type="button"
              disabled={turningOn}
              onClick={() =>
                startTurningOn(async () => {
                  setLookupError(null);
                  try {
                    const result = await enableLookup();
                    if (result.error) setLookupError(result.error);
                  } catch {
                    setLookupError("Couldn't turn it on, try again");
                  }
                })
              }
              className="shrink-0 rounded-full bg-amber-600 px-3 py-1 font-semibold text-white disabled:opacity-60"
            >
              {turningOn ? "Turning on…" : "Turn on lookup"}
            </button>
            {lookupError && <span className="text-dont">{lookupError}</span>}
          </div>
        )}
        <pre className="whitespace-pre-wrap rounded-2xl bg-white p-3 font-sans text-sm dark:bg-night-deep">{message}</pre>
      </details>
    </section>
  );
}
