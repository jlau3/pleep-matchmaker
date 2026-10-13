"use client";

import { CHOICE_LABEL, CHOICES, type Choice } from "@/lib/lines";

const ACTIVE: Record<Choice, string> = {
  want: "bg-want text-white border-want",
  undecided: "bg-meh text-white border-meh",
  dont_want: "bg-dont text-white border-dont",
};

/** "Show what others pick": a soft glow on the side the crowd leans to. */
const GLOW: Record<Choice, string> = {
  want: "ring-4 ring-want ring-offset-2 ring-offset-cream shadow-[0_0_22px_6px_rgb(63_184_107/0.6)] dark:ring-offset-night",
  undecided: "",
  dont_want: "ring-4 ring-dont ring-offset-2 ring-offset-cream shadow-[0_0_22px_6px_rgb(236_107_107/0.6)] dark:ring-offset-night",
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
  suggested,
}: {
  value?: Choice;
  onChoose: (choice: Choice) => void;
  compact?: boolean;
  /** The side most players pick, to glow (see CrowdHint). */
  suggested?: Choice;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHOICES.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={value === choice}
          onClick={() => onChoose(choice)}
          className={`rounded-full border-2 font-bold transition ${compact ? "px-1 py-1.5 text-xs" : "px-2 py-3 text-sm"} ${
            value === choice ? ACTIVE[choice] : IDLE[choice]
          } ${suggested === choice ? GLOW[choice] : ""}`}
        >
          {CHOICE_LABEL[choice]}
        </button>
      ))}
    </div>
  );
}
