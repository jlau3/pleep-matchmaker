"use client";

import { useState, useTransition } from "react";
import { blockUser } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

export function BlockButton({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <>
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Block ${name}? You'll stop seeing each other in matches and lookups.`)) {
          startTransition(async () => {
            try {
              await blockUser(userId);
            } catch (e) {
              rethrowIfNavigation(e);
              setFailed(true);
            }
          });
        }
      }}
      className="text-xs text-slate-500 underline hover:text-dont disabled:opacity-50"
    >
      Block
    </button>
    {failed && <span role="alert" className="text-xs text-dont">{SAVE_FAILED}</span>}
    </>
  );
}
