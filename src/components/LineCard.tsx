"use client";

import { type CandyLine, type Choice, spriteUrl } from "@/lib/lines";
import { ChoiceButtons } from "./ChoiceButtons";

export function LineCard({
  line,
  choice,
  onChoose,
  compact = false,
}: {
  line: CandyLine;
  choice?: Choice;
  onChoose: (choice: Choice) => void;
  compact?: boolean;
}) {
  const crowded = line.members.length > 4;
  const size = compact ? "h-12 w-12" : crowded ? "h-14 w-14 sm:h-20 sm:w-20" : "h-20 w-20 sm:h-24 sm:w-24";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className={`mb-2 font-bold ${compact ? "text-sm" : "text-lg"}`}>{line.name} candy</h2>
      <ul className="mb-3 flex flex-wrap justify-center gap-x-3 gap-y-2">
        {line.members.map((member) => (
          <li key={`${member.dex}-${member.sprite}`} className="flex flex-col items-center">
            <img src={spriteUrl(member.sprite)} alt={member.name} loading="lazy" className={`${size} object-contain`} />
            <span className={`text-center text-slate-500 dark:text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`}>
              {member.name}
            </span>
          </li>
        ))}
      </ul>
      <ChoiceButtons value={choice} onChoose={onChoose} compact={compact} />
    </div>
  );
}
