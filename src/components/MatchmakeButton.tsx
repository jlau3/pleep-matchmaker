"use client";

import { useTransition } from "react";
import { finishSorting } from "@/app/actions";

/** Saves every skipped line as undecided, then goes to matches. */
export function MatchmakeButton({ className }: { className: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => finishSorting())} className={`${className} disabled:opacity-60`}>
      {pending ? "Saving…" : "Matchmake"}
    </button>
  );
}
