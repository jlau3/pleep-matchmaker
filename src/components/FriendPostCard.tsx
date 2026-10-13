"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  topNames,
  wantNames,
}: {
  friendCode: string | null;
  /** Your in-game name, so readers recognize you in Pokémon Sleep. */
  ign: string | null;
  topNames: string[];
  wantNames: string[];
}) {
  const [origin, setOrigin] = useState("https://pleep-matchmaker.vercel.app");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  if (!friendCode) {
    return (
      <section className={callout}>
        <h2 className="mb-1 font-bold">📣 Looking for more friends?</h2>
        <p className="text-slate-700 dark:text-slate-300">
          Add your friend code in <Link href="/profile" className="underline">Profile → Settings</Link> to get a ready-made
          &quot;looking for friends&quot; post.
        </p>
      </section>
    );
  }

  const favorites = topNames.length > 0 ? `My Top ${topNames.length} candies: ${topNames.join(", ")}` : wantNames.length > 0 ? `Candies I'm after: ${wantNames.join(", ")}` : null;
  // The link opens Friends with your friend code already searched: unique, always set here, and
  // lookup matches it exactly (IGNs can be shared; Discord names can be hidden).
  const link = `${origin}/friends?q=${friendCode}`;
  const message = [
    "🌙 Looking for Pokémon Sleep friends!",
    ign ? `IGN: ${ign}` : null,
    `Friend code: ${formatFriendCode(friendCode)}`,
    favorites,
    `See how my candy wishlist fits your friends' on Pleep Matchmaker: ${link}`,
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
          <span className="font-bold">📣 Looking for more friends?</span>{" "}
          <span className="text-slate-700 dark:text-slate-300">Share a post with your friend code.</span>
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
      <pre className="whitespace-pre-wrap rounded-2xl bg-white p-3 font-sans text-sm dark:bg-night-deep">{message}</pre>
    </details>
  );
}
