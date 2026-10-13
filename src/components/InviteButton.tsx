"use client";

import { useState } from "react";

const MESSAGE = "I'm sharing Pokémon Sleep candy wishlists on Pleep Matchmaker. Add what you want so we know which candies to send for each other:";

/** Shares (phones) or copies (desktop) an invite with this site's link. */
export function InviteButton({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function invite() {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pleep Matchmaker", text: MESSAGE, url });
        return;
      } catch {
        // Canceled or blocked (some in-app browsers): fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(`${MESSAGE} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite:", `${MESSAGE} ${url}`);
    }
  }

  return (
    <button type="button" onClick={invite} className={`btn-primary px-4 py-1.5 text-sm ${className}`}>
      {copied ? "Invite copied!" : "Invite friends"}
    </button>
  );
}
