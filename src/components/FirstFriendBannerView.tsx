"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { markFirstFriendNoted } from "@/app/actions";
import { FIRST_FRIEND_COOKIE } from "@/lib/help";

/** The note itself. Already noted: remembers that in this browser and shows nothing. */
export function FirstFriendBannerView({ userId, noted }: { userId: string; noted: boolean }) {
  const [open, setOpen] = useState(!noted);

  useEffect(() => {
    if (noted) document.cookie = `${FIRST_FRIEND_COOKIE}=${userId}; path=/; max-age=31536000; samesite=lax`;
  }, [noted, userId]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    void markFirstFriendNoted().catch(() => {});
  };
  return (
    <div className="mx-auto max-w-5xl px-4 pt-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-want/40 bg-want/10 px-4 py-2 text-sm">
        <span>
          🎉 <strong>You have your first friend!</strong> Your Tier List now follows what your friends want.{" "}
          <Link href="/tiers?pool=friends" onClick={close} className="font-semibold underline">
            See it
          </Link>
        </span>
        <button type="button" onClick={close} aria-label="Close" className="shrink-0 rounded-full px-2 text-lg leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}
