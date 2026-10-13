"use client";

import type { CrowdHint } from "@/lib/crowd";
import { type CandyLine, CHOICE_LABEL, type Choice, spriteUrl } from "@/lib/lines";
import { ChoiceButtons } from "./ChoiceButtons";
import { StarButton } from "./StarButton";

export function LineCard({
  line,
  choice,
  onChoose,
  starred = false,
  onStar,
  compact = false,
  hint,
}: {
  line: CandyLine;
  choice?: Choice;
  onChoose: (choice: Choice) => void;
  starred?: boolean;
  /** Shows the Top 3 star in the top right corner when set. */
  onStar?: () => void;
  compact?: boolean;
  /** What other players pick, when "Show what others pick" is on. */
  hint?: CrowdHint;
}) {
  const crowded = line.members.length > 4;
  const size = compact ? "h-12 w-12" : crowded ? "h-14 w-14 sm:h-20 sm:w-20" : "h-20 w-20 sm:h-24 sm:w-24";
  return (
    <div className="card relative p-4">
      {onStar && <StarButton starred={starred} name={line.name} onClick={onStar} className="absolute right-2 top-2" />}
      <h2 className={`mb-2 pr-10 font-bold ${compact ? "text-sm" : "text-lg"}`}>{line.name} candy</h2>
      <ul className="mb-3 flex flex-wrap justify-center gap-x-3 gap-y-2">
        {line.members.map((member) => (
          <li key={`${member.dex}-${member.sprite}`} className="flex flex-col items-center">
            <img src={spriteUrl(member.sprite)} alt={member.name} loading="lazy" className={`${size} rounded-full bg-sky object-contain dark:bg-night-deep`} />
            <span className={`text-center text-slate-500 dark:text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`}>
              {member.name}
            </span>
          </li>
        ))}
      </ul>
      <ChoiceButtons value={choice ?? "undecided"} onChoose={onChoose} compact={compact} suggested={hint?.lean} />
      {hint && <p className={`mt-2 text-center text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>{hintText(hint)}</p>}
    </div>
  );
}

function hintText({ lean, wantPct, dontPct }: CrowdHint): string {
  const shares = `${wantPct}% want · ${dontPct}% don't`;
  if (lean !== "undecided") return `Most players: ${CHOICE_LABEL[lean]} (${shares})`;
  return Math.max(wantPct, dontPct) >= 25 ? `Players are split (${shares})` : `Few players feel strongly (${shares})`;
}
