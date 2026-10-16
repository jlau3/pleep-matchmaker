import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINKING_COOKIE, NEXT_COOKIE, SETUP_NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { createClient } from "@/lib/supabase/server";
import { signInLanding } from "@/lib/signInLanding";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase or Discord report failures as error/error_description params.
  let message = searchParams.get("error_description") ?? searchParams.get("error");
  const store = await cookies();
  // Linking another sign-in method (from Settings) goes back to Settings, errors included.
  const linking = store.get(LINKING_COOKIE)?.value;
  if (linking) {
    let error = message;
    if (code) {
      const supabase = await createClient();
      const exchanged = await supabase.auth.exchangeCodeForSession(code);
      error = exchanged.error?.message ?? null;
      // Copy the Discord name, display name and avatar from the linked Discord identity.
      if (!error) await supabase.rpc("sync_discord_identity");
    }
    const res = NextResponse.redirect(
      `${origin}/profile?${error ? `error=${encodeURIComponent(error)}` : `linked=${encodeURIComponent(linking)}`}`,
    );
    res.cookies.delete(LINKING_COOKIE);
    return res;
  }
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First-time players start setup; returning players resume their destination.
      const next = safeNextPath(store.get(NEXT_COOKIE)?.value);
      const destination = await signInLanding(supabase, data.user?.id, next);
      const res = NextResponse.redirect(`${origin}${destination}`);
      if (next && destination.startsWith("/profile?setup=profile")) res.cookies.set(SETUP_NEXT_COOKIE, next, { path: "/", maxAge: 604800, httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:") });
      else res.cookies.delete(SETUP_NEXT_COOKIE);
      if (next) res.cookies.delete(NEXT_COOKIE);
      return res;
    }
    message = error.message;
  }
  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(message ?? "No sign-in code received")}`);
}
