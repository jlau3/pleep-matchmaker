import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LINKING_COOKIE, NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { createClient } from "@/lib/supabase/server";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Back to where they were headed before signing in, if anywhere.
      const next = safeNextPath(store.get(NEXT_COOKIE)?.value);
      const res = NextResponse.redirect(`${origin}${next ?? "/"}`);
      if (next) res.cookies.delete(NEXT_COOKIE);
      return res;
    }
    message = error.message;
  }
  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(message ?? "No sign-in code received")}`);
}
