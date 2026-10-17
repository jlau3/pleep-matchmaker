"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { signInWithGoogleToken } from "@/app/actions";
import { rethrowIfNavigation } from "@/lib/saveError";

/** The bits of Google Identity Services (accounts.google.com/gsi/client) used here. */
interface GoogleId {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: "popup";
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Google's own sign-in button. Unlike the redirect through Supabase, Google's
 * popup names this site, not the Supabase project URL. The ID token goes to
 * signInWithGoogleToken, which starts the Supabase session server-side.
 * Shown only when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set (see SignInOptions).
 */
export function GoogleSignIn({ clientId, next }: { clientId: string; next: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    const id = window.google?.accounts?.id;
    if (!id || !box.current) return;
    // A fresh nonce per page: Google gets its hash, the server action gets the raw value.
    const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const hashed = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
    id.initialize({
      client_id: clientId,
      nonce: hashed,
      ux_mode: "popup",
      use_fedcm_for_button: true,
      callback: async ({ credential }) => {
        setError(null);
        try {
          const result = await signInWithGoogleToken(credential, raw, next);
          if (result?.error) setError(result.error);
        } catch (e) {
          rethrowIfNavigation(e);
          setError("Couldn't sign in with Google. Try again.");
        }
      },
    });
    id.renderButton(box.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "center",
      width: Math.min(400, Math.max(200, box.current.offsetWidth)),
    });
  }, [clientId, next]);

  return (
    <div>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => void render()} />
      {/* Google's button is an iframe with a light color scheme; in dark mode the page's dark scheme
          makes the browser paint a white box behind it. Matching the scheme keeps it transparent. */}
      <div ref={box} className="flex min-h-11 w-full justify-center [color-scheme:light]" />
      {error && (
        <p role="alert" className="mt-1 text-sm text-dont">
          {error}
        </p>
      )}
    </div>
  );
}
