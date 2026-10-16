"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { profileGuideError, type ProfileGuideStep } from "@/lib/profileGuide";
import { profileGuideScroll } from "@/lib/profileGuideScroll";
import { finishProfileSetup } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";

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
  continueTo,
}: {
  form: RefObject<HTMLFormElement | null>;
  steps: ProfileGuideStep[];
  initialStep: number;
  pending: boolean;
  result: { submission: number; saved?: boolean; error?: string };
  onClose: () => void;
  continueTo?: string | null;
}) {
  const router = useRouter();
  const [continuing, setContinuing] = useState(false);
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
  const [position, setPosition] = useState(() => ({
    top: 0, left: 16, arrow: 32, below: true,
    compact: typeof window !== "undefined" && (window.visualViewport?.height ?? window.innerHeight) < 680,
  }));

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

  // Reserve scroll space once, rather than removing and restoring it between
  // steps (which can clamp the scroll position near the end of the page).
  useLayoutEffect(() => {
    const root = form.current;
    if (!ready || !root) return;
    const previousPadding = root.style.paddingBottom;
    root.style.paddingBottom = `${window.innerHeight}px`;
    return () => { root.style.paddingBottom = previousPadding; };
  }, [ready, form]);

  useLayoutEffect(() => {
    const root = form.current;
    const target = root?.querySelector<HTMLElement>(`[data-profile-step="${step.id}"]`);
    const card = panel.current;
    const overlay = layer.current;
    if (!ready || !root || !target || !card || !overlay) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousRole = root.getAttribute("role");
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
    title.current?.focus({ preventScroll: true });

    const place = (reveal = false) => {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      let rect = target.getBoundingClientRect();
      const cardHeight = card.getBoundingClientRect().height;
      const cardWidth = Math.min(384, width - 32);
      const left = complete
        ? (viewport?.offsetLeft ?? 0) + (width - cardWidth) / 2
        : Math.max(16, Math.min(rect.left, width - cardWidth - 16));
      const scroll = !complete && reveal ? profileGuideScroll(rect, cardHeight, { top, height }, window.scrollY) : 0;
      if (scroll) {
        window.scrollBy({ top: scroll, behavior: "instant" });
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
    const reposition = () => place();
    const reveal = () => place(true);
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(target);
    observer.observe(card);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reveal);
    window.visualViewport?.addEventListener("resize", reveal);
    window.visualViewport?.addEventListener("scroll", reposition);

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
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reveal);
      window.visualViewport?.removeEventListener("resize", reveal);
      window.visualViewport?.removeEventListener("scroll", reposition);
      document.removeEventListener("keydown", keydown);
      target.classList.remove("profile-guide-target");
      madeInert.forEach((element) => {
        element.inert = false;
      });
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

  const continueAfterProfile = async () => {
    setContinuing(true);
    setError(null);
    try {
      const result = await finishProfileSetup(continueTo);
      if (result.error) { setError(result.error); return; }
      onClose();
      router.push(result.next ?? "/vote");
    } catch (error) {
      rethrowIfNavigation(error);
      setError(SAVE_FAILED);
    } finally { setContinuing(false); }
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
                {complete ? (continueTo ? "Your profile is ready" : "You're ready to vote") : step.title}
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
              ? continueTo ? "Your profile is saved. Continue to the page you opened. You can choose your candy wishlist from Profile later." : "Your profile is saved. Next, pick the candy you want your friends to send. You can change any profile option later."
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
              <button type="button" disabled={continuing} onClick={() => void continueAfterProfile()} className="btn-primary px-4 py-2 disabled:opacity-50">
                {continuing ? "Continuing…" : continueTo ? "Continue →" : "Choose my candy →"}
              </button>
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
