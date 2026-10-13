"use client";

import { useTransition } from "react";
import { dismissAddedYou } from "@/app/actions";

/** "Not now" for someone who added you. */
export function DismissAddedYou({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await dismissAddedYou(userId)))}
      className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:hover:text-white"
    >
      {pending ? "…" : "Not now"}
    </button>
  );
}
