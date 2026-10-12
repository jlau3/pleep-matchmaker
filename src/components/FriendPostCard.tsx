"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatFriendCode } from "@/lib/format";

/**
 * A ready-to-paste "looking for friends" post for anywhere players gather
 * (Discord, Reddit, group chats): friend code, Top 3
 * (or a few wants), and a pointer to look you up here, where search shows how
 * well your votes match theirs.
 */
export function FriendPostCard({
  friendCode,
  handle,
  searchName,
  topNames,
  wantNames,
}: {
  friendCode: string | null;
  /** How people find you in search: "@discordname" or an IGN. */
  handle: string | null;
  /** What the link pre-fills in search (Discord name or IGN); opens your search result directly. */
  searchName: string | null;
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
      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-bold">Share a friend post</h2>
        <p className="text-slate-600 dark:text-slate-300">
          Add your friend code in <Link href="/profile" className="underline">Profile → Settings</Link> to get a ready-made
          &quot;looking for friends&quot; post.
        </p>
      </section>
    );
  }

  const favourites = topNames.length > 0 ? `My Top ${topNames.length} candies: ${topNames.join(", ")}` : wantNames.length > 0 ? `Candies I'm after: ${wantNames.join(", ")}` : null;
  // The link opens Friends with your name already searched, showing their match % with you.
  const link = searchName ? `${origin}/friends?q=${encodeURIComponent(searchName)}` : origin;
  const where = handle ? `Pleep Matchmaker (I'm ${handle})` : "Pleep Matchmaker";
  const message = [
    "🌙 Looking for Pokémon Sleep friends!",
    `Friend code: ${formatFriendCode(friendCode)}`,
    favourites,
    `See how well our candy wishlists match on ${where}: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  async function share() {
    try {
      await navigator.share({ text: message });
    } catch {
      // Cancelled or unsupported here; Copy still works.
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
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Share a friend post</h2>
          <p className="text-xs text-slate-500">Paste it wherever you look for friends: Discord, Reddit, group chats.</p>
        </div>
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
    </section>
  );
}
