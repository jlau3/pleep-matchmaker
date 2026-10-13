"use client";

import { useState } from "react";
import { FriendButton } from "./FriendButton";

/**
 * Find New Friends cards: befriending happens in Pokémon Sleep first, so the
 * main action copies their friend code; adding them to your list here comes
 * after they accept, and only shows once the code is copied.
 */
export function ConnectSteps({ userId, friendCode, name }: { userId: string; friendCode: string | null; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
    } catch {
      window.prompt("Copy this friend code:", friendCode);
    }
    setCopied(true);
  }

  if (!copied) {
    return (
      <button type="button" onClick={copy} disabled={!friendCode} className="btn-primary px-4 py-1.5 text-sm">
        Copy friend code
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-sky/60 p-3 text-sm dark:bg-night-deep">
      <p>
        <strong>Copied!</strong> Send {name} a friend request in Pokémon Sleep. Once they accept, add them here so their
        candy shows on your Tier List.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <FriendButton userId={userId} isFriend={false} name={name} />
        <button type="button" onClick={copy} className="text-xs text-slate-500 underline">
          Copy again
        </button>
      </div>
    </div>
  );
}
