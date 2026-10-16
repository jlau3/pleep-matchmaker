"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { profileGuideScroll } from "@/lib/profileGuideScroll";

const SEEN_KEY = "pm_tier_tour_seen:v1";
const STEPS = [
  { selectors: ['[data-tier-tour="pool"]'], title: "Everyone or Your Friends", description: "Everyone shows the global Tier List. Sign up and add your Pokémon Sleep friends to see what they want in My Friends." },
  { selectors: ['[data-tier-tour="island"]', '[data-tier-tour="sleep"]'], title: "Narrow Down Your Options", description: "Choose an Island and Sleep Type to see the candy available where you're researching. Tap a selected filter again to clear it." },
  { selectors: ['[data-tier-tour="style"]'], title: "Choose a Ranking Style", description: "Open this menu to explore different views. Each style is explained inside." },
  { selectors: ['[data-tier-tour="export"]'], title: "Share Your Tier List", description: "Export an image of your current list, including your filters and ranking style. Preview it, then download, copy, or share." },
];

/** One tour per browser, shared between signed-out and signed-in visits. */
export function TierGuide({ root, signedIn }: { root: RefObject<HTMLDivElement | null>; signedIn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState(STEPS);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState({ top: 16, left: 16, targetTop: 0, targetLeft: 0, width: 0, height: 0 });
  const step = steps[index];
  const open = useCallback(() => {
    if (document.querySelector("dialog[open]")) return;
    const available = STEPS.filter((step) => step.selectors.every((selector) => root.current?.querySelector(selector)));
    if (!available.length) return;
    opened.current = true;
    setSteps(available.map((step) => signedIn && step === STEPS[0]
      ? { ...step, description: "Everyone shows the global Tier List. Add your Pokémon Sleep friends here; once they accept, My Friends shows what they want." } : step));
    setIndex(0);
    setActive(true);
    dialog.current?.showModal();
  }, [root, signedIn]);
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* The tour still closes without storage. */ }
    dialog.current?.close();
    setActive(false);
  };

  useEffect(() => {
    try { if (localStorage.getItem(SEEN_KEY) === "1") return; } catch { /* Show once this visit. */ }
    const showWhenReady = () => { if (!opened.current && !document.querySelector("dialog[open]")) open(); };
    showWhenReady();
    const observer = new MutationObserver(showWhenReady);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
    return () => observer.disconnect();
  }, [open]);

  useLayoutEffect(() => {
    if (!active || !panel.current) return;
    const targets = step.selectors.map((selector) => root.current?.querySelector<HTMLElement>(selector)).filter((node): node is HTMLElement => !!node);
    if (!targets.length) return;
    // Explanations never change a filter, pool, or ranking style.
    const place = (reveal = false) => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const bounds = () => {
        const rects = targets.map((target) => target.getBoundingClientRect());
        return { top: Math.min(...rects.map((r) => r.top)) - 6, bottom: Math.max(...rects.map((r) => r.bottom)) + 6,
          left: Math.min(...rects.map((r) => r.left)) - 6, right: Math.max(...rects.map((r) => r.right)) + 6 };
      };
      let rect = bounds();
      const cardHeight = panel.current!.getBoundingClientRect().height;
      const cardWidth = Math.min(384, width - 32);
      const scroll = reveal ? profileGuideScroll(rect, cardHeight, { top: viewportTop, height }, window.scrollY) : 0;
      if (scroll) { window.scrollBy({ top: scroll, behavior: "instant" }); rect = bounds(); }
      const below = rect.bottom + 16 + cardHeight <= viewportTop + height - 16;
      const desiredTop = below ? rect.bottom + 16 : rect.top - cardHeight - 16;
      setPosition({
        top: Math.max(viewportTop + 16, Math.min(desiredTop, viewportTop + height - cardHeight - 16)),
        left: Math.max(viewportLeft + 16, Math.min(rect.left, viewportLeft + width - cardWidth - 16)),
        targetTop: rect.top, targetLeft: rect.left, width: rect.right - rect.left, height: rect.bottom - rect.top,
      });
    };
    const reposition = () => place();
    const reveal = () => place(true);
    reveal();
    title.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(reposition);
    targets.forEach((target) => observer.observe(target));
    observer.observe(panel.current);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reveal);
    window.visualViewport?.addEventListener("resize", reveal);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reveal);
      window.visualViewport?.removeEventListener("resize", reveal);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [active, step, root]);

  return <>
    <button type="button" onClick={open} className="text-sm font-semibold underline">Tier List tour</button>
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-transparent dark:text-white">
      {active && <>
        <div aria-hidden="true" data-tier-tour-outline style={{ top: position.targetTop, left: position.targetLeft, width: position.width, height: position.height }}
          className="pointer-events-none fixed rounded-xl border-4 border-sun shadow-[0_0_0_100vmax_rgba(0,0,0,0.6)]" />
        <div ref={panel} data-tier-tour-panel style={{ top: position.top, left: position.left }}
          className="fixed max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-sun bg-cream p-4 shadow-2xl dark:bg-night">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold text-slate-500">Step {index + 1} of {steps.length}</p>
              <h2 ref={title} id={titleId} tabIndex={-1} className="mt-1 text-lg font-extrabold outline-none">{step.title}</h2></div>
            <button type="button" onClick={close} aria-label="Close Tier List tour" className="rounded-full px-2 text-xl text-slate-500">×</button>
          </div>
          <p id={descriptionId} className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={close} className="text-sm font-semibold text-slate-500 underline">Skip tour</button>
            <div className="flex items-center gap-3">
              {index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className="text-sm font-semibold underline">Back</button>}
              <button type="button" onClick={() => index === steps.length - 1 ? close() : setIndex(index + 1)} className="btn-primary px-4 py-2">{index === steps.length - 1 ? "Got it" : "Next →"}</button>
            </div>
          </div>
        </div>
      </>}
    </dialog>
  </>;
}
