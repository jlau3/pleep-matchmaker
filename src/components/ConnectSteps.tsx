"use client";

import { useState } from "react";
import { FriendButton } from "./FriendButton";

/**
 * Find New Friends cards: Copy friend code (for the request in Pokémon Sleep)
 * and Add friend (to your list here) side by side, with a one-line note on the
 * order. Copying swaps the note for a confirmation.
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} disabled={!friendCode} className="btn-primary px-4 py-1.5 text-sm">
          {copied ? "Copied ✓" : "Copy friend code"}
        </button>
        <FriendButton userId={userId} isFriend={false} name={name} />
      </div>
      <p className="text-xs text-slate-500">
        {copied ? (
          <>
            <strong>Copied!</strong> Send {name} a friend request in Pokémon Sleep, then add them here so their candy
            shows on your Tier List.
          </>
        ) : (
          "Send a request in Pokémon Sleep with their code, then add them here so their candy shows on your Tier List."
        )}
      </p>
    </div>
  );
}
