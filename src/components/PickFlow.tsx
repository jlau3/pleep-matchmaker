"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { CrowdHint } from "@/lib/crowd";
import type { CandyLine, Choice } from "@/lib/lines";
import { LineCard } from "./LineCard";

/** One big card per line in a single column. Deciding an undecided card scrolls to the next one. */
export function PickFlow({
  lines,
  choices,
  onChoose,
  tops,
  onStar,
  hints,
  toolbar,
}: {
  lines: CandyLine[];
  choices: Record<string, Choice>;
  onChoose: (lineId: string, choice: Choice) => void;
  tops: Set<string>;
  onStar: (lineId: string) => void;
  /** Crowd hints per line id, when "Show what others pick" is on. */
  hints?: Record<string, CrowdHint>;
  toolbar?: RefObject<HTMLDivElement | null>;
}) {
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const target = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const destination = useRef<number | null>(null);
  const alignNext = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const card = target.current ? cardRefs.current.get(target.current) : null;
      if (!card) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const bar = toolbar?.current;
      // Use its sticky position, even if the toolbar has not stuck yet.
      const covered = bar ? (Number.parseFloat(getComputedStyle(bar).top) || 0) + bar.getBoundingClientRect().height : 0;
      const visibleTop = Math.max(viewportTop, covered) + 12;
      const available = Math.max(0, viewportBottom - 12 - visibleTop);
      const bounds = card.getBoundingClientRect();
      const cardTop = visibleTop + Math.max(0, (available - bounds.height) / 2);
      const next = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, window.scrollY + bounds.top - cardTop));
      if (destination.current !== null && Math.abs(next - destination.current) < 1) return;
      destination.current = next;
      window.scrollTo({ top: next, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }, [toolbar]);

  useEffect(() => {
    // Saved-vote progress and community hints can change layout after the tap.
    // Track those changes until the player starts another interaction.
    const observer = new ResizeObserver(alignNext);
    observer.observe(document.body);
    if (toolbar?.current) observer.observe(toolbar.current);
    const cancel = () => {
      if (target.current) window.scrollTo({ top: window.scrollY, behavior: "instant" });
      target.current = null;
      destination.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, cancel, { passive: true }));
    window.addEventListener("resize", alignNext);
    window.visualViewport?.addEventListener("resize", alignNext);
    return () => {
      observer.disconnect();
      events.forEach((event) => window.removeEventListener(event, cancel));
      window.removeEventListener("resize", alignNext);
      window.visualViewport?.removeEventListener("resize", alignNext);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [alignNext, toolbar]);

  function choose(index: number, line: CandyLine, choice: Choice) {
    const next = (choices[line.id] ?? "undecided") === "undecided" ? lines[index + 1] : undefined;
    target.current = next?.id ?? null;
    destination.current = null;
    onChoose(line.id, choice);
    // Measure after the selected state has rendered, rather than before voting.
    alignNext();
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
