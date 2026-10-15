"use client";

import { useState } from "react";
import type { Choice } from "@/lib/lines";
import { votesCsv, votesText } from "@/lib/voteExport";

/** Export your current votes: copy as text to paste anywhere, or download a CSV for a spreadsheet. */
export function ExportVotes({ choices, tops }: { choices: Record<string, Choice>; tops: Set<string> }) {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(votesText(choices, tops));
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2000);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([votesCsv(choices, tops)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pleep-votes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const button = "rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-white/60 dark:border-slate-600 dark:hover:bg-night";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Export my votes</span>
      <button type="button" onClick={copy} className={button}>
        {copied === "ok" ? "Copied" : copied === "failed" ? "Couldn't copy" : "Copy as text"}
      </button>
      <button type="button" onClick={download} className={button}>
        Download CSV
      </button>
    </div>
  );
}
