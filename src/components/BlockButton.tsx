"use client";

import { useTransition } from "react";
import { blockUser } from "@/app/actions";

export function BlockButton({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Block ${name}? You'll stop seeing each other in matches and lookups.`)) {
          startTransition(() => blockUser(userId));
        }
      }}
      className="text-xs text-slate-500 underline hover:text-dont disabled:opacity-50"
    >
      Block
    </button>
  );
}
