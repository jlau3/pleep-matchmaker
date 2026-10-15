"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { profileGuideError, type ProfileGuideStep } from "@/lib/profileGuide";

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/** Highlights the real form controls. The rest of the page is dimmed and inert. */
export function ProfileGuide({
  form,
  steps,
  initialStep,
  pending,
  result,
  onClose,
}: {
  form: RefObject<HTMLFormElement | null>;
  steps: ProfileGuideStep[];
  initialStep: number;
  pending: boolean;
  result: { submission: number; saved?: boolean; error?: string };
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialStep);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const requestedSubmission = useRef<number | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const step = steps[index];
  const [position, setPosition] = useState({ top: 0, left: 16, arrow: 32, below: true, compact: false });

  // Welcome and the native icon picker take precedence over this overlay.
  useEffect(() => {
    const check = () => setReady(!document.querySelector("dialog[open]"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (requestedSubmission.current === null || result.submission < requestedSubmission.current) return;
    requestedSubmission.current = null;
    setWaiting(false);
    if (!result.saved) return;
    if (index === steps.length - 1) setComplete(true);
    else setIndex((current) => current + 1);
  }, [result, index, steps.length]);

  useLayoutEffect(() => {
    const root = form.current;
    const target = root?.querySelector<HTMLElement>(`[data-profile-step="${step.id}"]`);
    const card = panel.current;
    const overlay = layer.current;
    if (!ready || !root || !target || !card || !overlay) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousRole = root.getAttribute("role");
    const previousPadding = root.style.paddingBottom;
    // Allow the final controls to scroll clear of the floating card, too.
    root.style.paddingBottom = `${window.innerHeight}px`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "profile-guide-title");
    root.setAttribute("aria-describedby", "profile-guide-description");
    if (!complete) target.classList.add("profile-guide-target");

    // Keep only the target controls and guide available to mouse, keyboard and screen readers.
    const madeInert: HTMLElement[] = [];
    const isolate = (element: HTMLElement) => {
      if (element === target || element === overlay) return;
      if (element.contains(target) || element.contains(overlay)) {
        Array.from(element.children).forEach((child) => child instanceof HTMLElement && isolate(child));
      } else if (!element.inert && !["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) {
        element.inert = true;
        madeInert.push(element);
      }
    };
    isolate(document.body);
    if (!complete) target.scrollIntoView({ block: "center", behavior: "instant" });
    title.current?.focus({ preventScroll: true });

    const place = () => {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      let rect = target.getBoundingClientRect();
      const cardHeight = card.getBoundingClientRect().height;
      const cardWidth = Math.min(384, width - 32);
      const left = Math.max(16, Math.min(rect.left, width - cardWidth - 16));
      if (
        !complete &&
        rect.height + cardHeight + 52 <= height &&
        rect.bottom + cardHeight + 36 > top + height &&
        rect.top - cardHeight - 20 < top + 16
      ) {
        window.scrollBy({ top: rect.top - top - 16, behavior: "instant" });
        rect = target.getBoundingClientRect();
      }
      const below = rect.bottom + 20 + cardHeight <= top + height - 16;
      const desiredTop = complete ? top + (height - cardHeight) / 2 : below ? rect.bottom + 20 : rect.top - cardHeight - 20;
      setPosition({
        top: Math.max(top + 16, Math.min(desiredTop, top + height - cardHeight - 16)),
        left,
        arrow: Math.max(20, Math.min(rect.left + rect.width / 2 - left, cardWidth - 28)),
        below,
        compact: height < 680,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(target);
    observer.observe(card);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);

    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(!complete ? Array.from(target.querySelectorAll<HTMLElement>(FOCUSABLE)) : []),
        ...Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)),
      ].filter((element) => !element.closest("[inert]") && element.getClientRects().length > 0);
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      const next =
        current < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next].focus();
    };
    document.addEventListener("keydown", keydown);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      document.removeEventListener("keydown", keydown);
      target.classList.remove("profile-guide-target");
      madeInert.forEach((element) => {
        element.inert = false;
      });
      root.style.paddingBottom = previousPadding;
      if (previousRole) root.setAttribute("role", previousRole);
      else root.removeAttribute("role");
      root.removeAttribute("aria-modal");
      root.removeAttribute("aria-labelledby");
      root.removeAttribute("aria-describedby");
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [ready, index, complete, form, step.id]);

  const next = (submitter: HTMLButtonElement) => {
    if (!form.current || pending || waiting) return;
    const problem = profileGuideError(step.id, new FormData(form.current));
    setError(problem);
    if (problem || !form.current.reportValidity()) return;
    requestedSubmission.current = result.submission + 1;
    setWaiting(true);
    form.current.requestSubmit(submitter);
  };

  if (!ready) return null;
  return (
    <div ref={layer}>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" />
      <div
        ref={panel}
        data-guide-panel
        style={{ top: position.top, left: position.left }}
        className="fixed z-[60] w-[calc(100%-2rem)] max-w-sm text-ink dark:text-white"
      >
        {!complete && (
          <span
            aria-hidden="true"
            style={{ left: position.arrow, [position.below ? "top" : "bottom"]: -7 }}
            className="absolute h-3 w-3 rotate-45 bg-cream dark:bg-night"
          />
        )}
        <div
          className={`max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-sun bg-cream shadow-2xl dark:bg-night ${position.compact ? "p-3" : "p-5"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {complete ? "Profile ready" : `Profile setup · ${index + 1} of ${steps.length}`}
              </p>
              <h2
                ref={title}
                id="profile-guide-title"
                tabIndex={-1}
                className={`mt-1 font-extrabold outline-none ${position.compact ? "text-base leading-tight" : "text-lg"}`}
              >
                {complete ? "You're ready to vote" : step.title}
              </h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close profile guide" className="rounded-full px-2 text-xl text-slate-500">
              ×
            </button>
          </div>
          <p
            id="profile-guide-description"
            className={position.compact && !complete ? "sr-only" : "mt-2 text-sm text-slate-600 dark:text-slate-300"}
          >
            {complete
              ? "Your profile is saved. Next, pick the candy you want your friends to send. You can change any profile option later."
              : step.description}
          </p>
          {(error || result.error) && (
            <p role="alert" className="mt-3 text-sm text-dont">
              {error || result.error}
            </p>
          )}
          <div className={`${position.compact ? "mt-3 justify-end" : "mt-4 justify-between"} flex flex-wrap items-center gap-3`}>
            {(!position.compact || complete) && (
              <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 underline">
                {complete ? "Stay on profile" : "Finish later"}
              </button>
            )}
            {complete ? (
              <Link href="/vote" onClick={onClose} className="btn-primary px-4 py-2">
                Choose my candy →
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                {index > 0 && (
                  <button
                    type="button"
                    disabled={pending || waiting}
                    onClick={() => {
                      setError(null);
                      setIndex(index - 1);
                    }}
                    className="text-sm font-semibold underline disabled:opacity-50"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  name="profile_step"
                  value={step.id}
                  disabled={pending || waiting}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={(event) => { event.preventDefault(); next(event.currentTarget); }}
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {pending || waiting ? "Saving…" : index === steps.length - 1 ? "Finish profile" : "Next →"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
