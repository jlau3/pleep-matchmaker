"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatFriendCode } from "@/lib/format";

/**
 * A ready-to-paste "looking for friends" post for Discord: friend code, Top 3
 * (or a few wants), and a pointer to look you up here, where search shows how
 * well your votes match theirs.
 */
export function FriendPostCard({
  friendCode,
  handle,
  topNames,
  wantNames,
}: {
  friendCode: string | null;
  /** How people find you in search: "@discordname" or an IGN. */
  handle: string | null;
  topNames: string[];
  wantNames: string[];
}) {
  const [origin, setOrigin] = useState("https://pleep-matchmaker.vercel.app");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  if (!friendCode) {
    return (
      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-bold">Post on Discord</h2>
        <p className="text-slate-600 dark:text-slate-300">
          Add your friend code in <Link href="/profile" className="underline">Profile → Settings</Link> to get a ready-made
          &quot;looking for friends&quot; post.
        </p>
      </section>
    );
  }

  const favourites = topNames.length > 0 ? `My Top ${topNames.length} candies: ${topNames.join(", ")}` : wantNames.length > 0 ? `Candies I'm after: ${wantNames.join(", ")}` : null;
  const lookup = handle ? `Look me up (${handle}) on Pleep Matchmaker` : "Find me on Pleep Matchmaker";
  const message = [
    "🌙 Looking for Pokémon Sleep friends!",
    `Friend code: ${formatFriendCode(friendCode)}`,
    favourites,
    `Curious if our candy wishlists match? ${lookup}: ${origin}`,
  ]
    .filter(Boolean)
    .join("\n");

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
          <h2 className="font-bold">Post on Discord</h2>
          <p className="text-xs text-slate-500">Paste this in a Pokémon Sleep friend-code channel.</p>
        </div>
        <button type="button" onClick={copy} className="btn-primary shrink-0 px-4 py-1.5 text-sm">
          {copied ? "Copied!" : "Copy post"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-2xl bg-white p-3 font-sans text-sm dark:bg-night-deep">{message}</pre>
    </section>
  );
}
