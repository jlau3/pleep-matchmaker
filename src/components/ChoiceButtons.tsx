"use client";

import { CHOICE_LABEL, CHOICES, type Choice } from "@/lib/lines";

const ACTIVE: Record<Choice, string> = {
  want: "bg-want text-white border-want",
  undecided: "bg-meh text-white border-meh",
  dont_want: "bg-dont text-white border-dont",
};

const IDLE: Record<Choice, string> = {
  want: "border-want/40 text-want hover:bg-want/10",
  undecided: "border-meh/40 text-meh hover:bg-meh/10",
  dont_want: "border-dont/40 text-dont hover:bg-dont/10",
};

export function ChoiceButtons({
  value,
  onChoose,
  compact = false,
}: {
  value?: Choice;
  onChoose: (choice: Choice) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHOICES.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={value === choice}
          onClick={() => onChoose(choice)}
          className={`rounded-lg border-2 font-semibold transition-colors ${compact ? "px-1 py-1.5 text-xs" : "px-2 py-3 text-sm"} ${
            value === choice ? ACTIVE[choice] : IDLE[choice]
          }`}
        >
          {CHOICE_LABEL[choice]}
        </button>
      ))}
    </div>
  );
}
