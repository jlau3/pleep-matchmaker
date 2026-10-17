"use client";

import { type CandyLine, type Choice } from "@/lib/lines";
import { voteExport } from "@/lib/voteExport";
import { ImageExport, today } from "./TierExport";

/** Current filtered votes plus the complete Top 3 Spotlight. */
export function ExportVotes({ choices, tops, lines, filterLabel }: {
  choices: Record<string, Choice>;
  tops: Set<string>;
  lines: CandyLine[];
  filterLabel: string;
}) {
  const { rows, counts } = voteExport(choices, tops, lines);
  return (
    <span className="shrink-0">
      <ImageExport
        title="My Votes"
        heading="My Candy Votes"
        subtitle={() => [filterLabel, `Want ${counts.want} · Neutral ${counts.undecided} · Don't Want ${counts.dont_want}`, today()].filter(Boolean).join(" · ")}
        sections={() => [{ rows }]}
        file="my-candy-votes.png"
        label="Export Image"
        buttonClassName="py-1 text-sm font-semibold underline underline-offset-2 disabled:opacity-60"
      />
    </span>
  );
}
