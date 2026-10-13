"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { relativeTime } from "@/lib/format";

/**
 * "Updated 12m ago · Refresh". Pages are kept in the browser for the visit
 * (staleTimes in next.config.ts), so this says how old the numbers are and
 * reloads them on demand. The age only renders after mount, so server and
 * browser clocks never disagree on the first paint.
 */
export function RefreshStamp({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [loadedAt]);

  return (
    <span className="text-xs text-slate-500">
      {now !== null && <>Updated {relativeTime(loadedAt, now)} · </>}
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        className="font-semibold underline disabled:no-underline disabled:opacity-60"
      >
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </span>
  );
}
