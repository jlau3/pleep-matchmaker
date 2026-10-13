"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { markMetaSeen } from "@/app/actions";
import { META_COOKIE } from "@/content/meta";

/**
 * The new-Pokémon meta note, popped up once per account while it's active
 * (see src/content/meta.tsx). Closing it records that on the account.
 */
export function MetaNoteModal({
  postId,
  title,
  sprite,
  autoOpen,
  rememberSeen,
  children,
}: {
  postId: string;
  title: string;
  sprite: string | null;
  autoOpen: boolean;
  /** Cookie value to store when the account has already seen this note. */
  rememberSeen: string | null;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingSeen = useRef(autoOpen);

  useEffect(() => {
    if (autoOpen) dialog.current?.showModal();
    else if (rememberSeen) document.cookie = `${META_COOKIE}=${rememberSeen}; path=/; max-age=31536000; samesite=lax`;
  }, [autoOpen, rememberSeen]);

  function onClose() {
    if (!pendingSeen.current) return;
    pendingSeen.current = false;
    void markMetaSeen(postId).catch(() => {});
  }

  if (!autoOpen) return null;
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) dialog.current?.close();
      }}
      aria-labelledby="meta-title"
      className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          {sprite && <img src={sprite} alt="" className="h-14 w-14 shrink-0 rounded-full bg-sky object-contain dark:bg-night-deep" />}
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-sun-deep">New Pokémon</p>
            <h2 id="meta-title" className="text-2xl font-extrabold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="guide-body">{children}</div>
        <p className="mt-5 text-sm text-slate-500">
          You can find this again under <Link href="/guides" className="font-semibold underline">Guides</Link>.
        </p>
        <button type="button" onClick={() => dialog.current?.close()} className="btn-primary mt-4 w-full py-2">
          Got it
        </button>
      </div>
    </dialog>
  );
}
