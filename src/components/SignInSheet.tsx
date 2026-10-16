"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { safeNextPath } from "@/lib/nextPath";
import { signInReason } from "@/lib/signInSheet";
import { SignInOptions } from "./SignInOptions";

const SignInContext = createContext<(next?: string, reason?: string) => void>(() => {});
export const useSignIn = () => useContext(SignInContext);

export function SignInProvider({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [request, setRequest] = useState<{ next: string | null; reason: string; error?: string }>({ next: null, reason: "" });
  const pathname = usePathname();
  const open = useCallback((next?: string, reason?: string) => {
    const destination = safeNextPath(next);
    setRequest({ next: destination, reason: reason ?? (destination ? signInReason(destination) : "Save your wishlist and see what your friends want.") });
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (signedIn) { dialog.current?.close(); return; }
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("error_description") || params.get("signin") === "1" || (pathname === "/" && params.has("next"))) {
      const next = safeNextPath(params.get("next"));
      open(next ?? undefined);
      const error = params.get("error_description") ?? params.get("error");
      if (error) setRequest((current) => ({ ...current, error: error.slice(0, 200) }));
    }
  }, [signedIn, pathname, open]);

  return (
    <SignInContext.Provider value={open}>
      {children}
      <dialog ref={dialog} aria-labelledby="sign-in-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-cream p-6 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 id="sign-in-title" className="text-2xl font-extrabold">Sign in</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close sign in" className="rounded-full px-2 text-2xl text-slate-500">×</button>
        </div>
        <p className="mt-3 text-sm">{request.reason}</p>
        <p className="mt-2 text-sm text-slate-500">New here? This also creates your account.</p>
        <div className="my-5"><SignInOptions next={request.next} /></div>
        {request.error && <p role="alert" className="mb-4 text-sm text-dont">{request.error}</p>}
        <h3 className="text-sm font-bold">What You Get</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>A candy wishlist your friends can use.</li><li>A Tier List based on your friends' votes.</li><li>New friends who want the candy you send.</li>
        </ul>
      </dialog>
    </SignInContext.Provider>
  );
}

export function SignInButton() {
  const open = useSignIn();
  return <button type="button" onClick={() => open()} className="btn-primary shrink-0 whitespace-nowrap px-3 py-1.5 text-sm">Sign in</button>;
}

export function AutoSignIn({ destination }: { destination: string }) {
  const open = useSignIn();
  useEffect(() => { open(destination); }, [destination, open]);
  return <button type="button" onClick={() => open(destination)} className="btn-primary mt-4 px-5 py-2">Sign in</button>;
}
