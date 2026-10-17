"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { snorlaxVariant } from "@/lib/snorlax";
import { HowItWorks } from "./HowItWorks";
import { useSignIn } from "./SignInSheet";

type Appearance = { variant: "normal" | "shiny"; id: number; phase: "entering" | "settled" | "leaving"; reduced: boolean; x: number; y: number };
const spritePath = (variant: Appearance["variant"], file: string) => `/easter-eggs/snorlax/${variant}/${file}.png`;

export function PokeballButton({ signedIn }: { signedIn: boolean }) {
  const signedInNow = useRef(signedIn);
  signedInNow.current = signedIn;
  const trigger = useRef<HTMLButtonElement>(null);
  const intro = useRef<HTMLDialogElement>(null);
  const sprite = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const loading = useRef(false);
  const live = useRef(true);
  const sequence = useRef(0);
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [error, setError] = useState(false);
  const openSignIn = useSignIn();

  useEffect(() => { if (!signedIn) { animation.current?.cancel(); setAppearance(null); setError(false); } }, [signedIn]);
  useEffect(() => { live.current = true; return () => { live.current = false; animation.current?.cancel(); }; }, []);

  useEffect(() => {
    if (appearance?.phase !== "entering" || !sprite.current) return;
    const element = sprite.current;
    const frames = () => {
      const viewport = window.visualViewport;
      const top = Math.max(viewport?.offsetTop ?? 0, document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 48) + 16;
      const bottom = Math.max(top, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - element.offsetHeight - 16);
      return [{ transform: "translateY(-100%)" }, { transform: `translateY(${top + appearance.y * (bottom - top)}px)` }];
    };
    const drop = element.animate(frames(), {
      duration: appearance.reduced ? 0 : 650, easing: "cubic-bezier(.32,.02,.7,1)", fill: "forwards",
    });
    animation.current = drop;
    void drop.finished.then(() => {
      if (!live.current) return;
      setAppearance((current) => current?.id === appearance.id && current.phase === "entering" ? { ...current, phase: "settled" } : current);
      if (document.activeElement === trigger.current) element.focus({ preventScroll: true });
    }).catch(() => {});
    // Update the filled landing transform without restarting the drop or APNG.
    const reposition = () => { if (animation.current === drop) (drop.effect as KeyframeEffect).setKeyframes(frames()); };
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      drop.cancel();
    };
  }, [appearance?.id, appearance?.reduced, appearance?.y]);

  async function activate() {
    if (!signedIn) { intro.current?.showModal(); return; }
    if (appearance || loading.current) return;
    loading.current = true;
    setError(false);
    const variant = snorlaxVariant();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const image = new Image();
      image.src = spritePath(variant, reduced ? "rest" : "first");
      await image.decode();
      if (live.current && signedInNow.current) setAppearance({ variant, reduced, id: ++sequence.current, phase: "entering", x: Math.random(), y: Math.random() });
    } catch { if (live.current) setError(true); }
    finally { loading.current = false; }
  }

  function dismiss() {
    const element = sprite.current;
    if (!element || !appearance || appearance.phase === "leaving") return;
    const start = getComputedStyle(element).transform;
    animation.current?.cancel();
    element.style.transform = start;
    setAppearance({ ...appearance, phase: "leaving" });
    const fall = element.animate([{ transform: start, opacity: 1 }, { transform: `translateY(${window.innerHeight + 224}px) rotate(8deg)`, opacity: 0.3 }], {
      duration: appearance.reduced ? 0 : 500, easing: "ease-in", fill: "forwards",
    });
    animation.current = fall;
    void fall.finished.then(() => {
      if (!live.current) return;
      if (document.activeElement === element) trigger.current?.focus({ preventScroll: true });
      setAppearance(null);
    }).catch(() => {});
  }

  const resting = appearance?.reduced ? "rest" : "first";
  const source = appearance?.phase === "settled" && !appearance.reduced
    ? `${spritePath(appearance.variant, "once")}?play=${appearance.id}`
    : appearance ? spritePath(appearance.variant, appearance.phase === "leaving" ? "first" : resting) : "";

  return <>
    <button ref={trigger} type="button" onClick={() => void activate()} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun"
      aria-label={signedIn ? "A Snorlax surprise" : "What Pleep Does"} title={signedIn ? "A Snorlax surprise" : "What Pleep Does"}>
      <img src="/logo.png" alt="" className="h-8 w-8" />
    </button>
    {!signedIn && <dialog ref={intro} aria-labelledby="pleep-intro-title"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) intro.current?.close();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-5 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-white">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id="pleep-intro-title" className="text-2xl font-extrabold">What Pleep Does</h2>
        <button type="button" aria-label="Close site overview" onClick={() => intro.current?.close()} className="rounded-full px-2 text-2xl leading-none text-slate-500">×</button>
      </div>
      <HowItWorks />
      <button type="button" onClick={() => { intro.current?.close(); openSignIn(window.location.pathname + window.location.search); }} className="btn-primary mt-5 px-5 py-2">Sign in to Get Started</button>
    </dialog>}
    {appearance && createPortal(<div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"><button ref={sprite} type="button" onClick={dismiss} data-snorlax-phase={appearance.phase}
      aria-label={appearance.variant === "shiny" ? "Dismiss shiny Snorlax" : "Dismiss Snorlax"} title="Click Snorlax to send it on its way"
      style={{ left: `calc(${appearance.x * 100}% + ${16 * (1 - 2 * appearance.x)}px)`, translate: `${-appearance.x * 100}% 0` }}
      className="pointer-events-auto absolute top-0 h-[min(12rem,calc(100dvh-80px))] w-[min(12rem,calc(100vw-32px),calc(100dvh-80px))] border-0 bg-transparent p-0 focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-sun">
      <img src={source} alt="" draggable={false} onError={() => { animation.current?.cancel(); setAppearance(null); setError(true); }} className="h-full w-full object-contain [image-rendering:pixelated]" />
    </button></div>, document.body)}
    {error && createPortal(<div role="status" className="fixed left-1/2 top-16 z-[60] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-cream p-3 text-sm text-ink shadow-lg dark:bg-night dark:text-white">
      Couldn&apos;t load Snorlax. <button type="button" onClick={() => void activate()} className="font-semibold underline">Try again</button>.
      <button type="button" onClick={() => setError(false)} aria-label="Close Snorlax message" className="ml-3 font-semibold">×</button>
    </div>, document.body)}
  </>;
}
