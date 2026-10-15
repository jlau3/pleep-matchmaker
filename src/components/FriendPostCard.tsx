"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
  friendCode,
  ign,
  allowLookup,
  topNames,
  wantNames,
}: {
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
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  if (!friendCode) {
    return (
      <section className={callout}>
        <p className="text-slate-700 dark:text-slate-300">
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
    ign ? `IGN: ${ign}` : null,
    `Friend code: ${formatFriendCode(friendCode)}`,
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
    <details className={`${callout} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
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
  );
}
