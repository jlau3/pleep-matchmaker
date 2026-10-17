"use client";

import { useEffect, useRef } from "react";
import type { CrowdHint } from "@/lib/crowd";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** One big card per line. Every successful vote tap advances exactly one card. */
export function PickFlow({
  lines,
  choices,
  onChoose,
  tops,
  onStar,
  hints,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void | boolean | Promise<void | boolean>;
  tops: Set<string>;
  onStar: (lineId: string) => void;
  /** Crowd hints per line id, when "Show what others pick" is on. */
  hints?: Record<string, CrowdHint>;
}) {
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const request = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Manual interaction cancels a pending advance. No long-lived layout
    // observer or viewport listener may restart scrolling after a vote.
    const cancel = () => {
      request.current++;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, cancel, { passive: true }));
    return () => {
      cancel();
      events.forEach((event) => window.removeEventListener(event, cancel));
    };
  }, []);

  function choose(index: number, line: CandyLine, choice: Choice) {
    const next = lines[index + 1];
    const token = ++request.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const saved = onChoose(line.id, choice);
    if (!next) return;
    // Wait for first-vote setup progress as well as the optimistic button state.
    // Stale/failed saves or manual scrolling cannot trigger a later advance.
    void Promise.resolve(saved).then((success) => {
      if (success === false || request.current !== token) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (request.current !== token) return;
        const card = cardRefs.current.get(next.id);
        if (!card) return;
        const header = document.querySelector<HTMLElement>("[data-site-header]");
        const covered = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
        const available = (window.visualViewport?.height ?? window.innerHeight) - covered - 24;
        const tall = card.getBoundingClientRect().height > available;
        // Native scrolling avoids mixing document and visual-viewport offsets
        // during mobile browser chrome changes. The margin reserves the fixed site header.
        card.style.scrollMarginTop = `${covered + (tall ? 12 : 0)}px`;
        card.scrollIntoView({
          block: tall ? "start" : "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
      });
    }, () => {});
  }

  return (
    <ol className="mx-auto max-w-md space-y-6">
      {lines.map((line, index) => (
        <li
          key={line.id}
          ref={(el) => {
            if (el) cardRefs.current.set(line.id, el);
            else cardRefs.current.delete(line.id);
          }}
        >
          <LineCard
            line={line}
            choice={choices[line.id]}
            onChoose={(choice) => choose(index, line, choice)}
            starred={tops.has(line.id)}
            onStar={() => onStar(line.id)}
          hint={hints?.[line.id]}
          />
        </li>
      ))}
    </ol>
  );
}
