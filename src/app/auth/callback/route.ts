import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase or Discord report failures as error/error_description params.
  let message = searchParams.get("error_description") ?? searchParams.get("error");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Back to where they were headed before signing in, if anywhere.
      const store = await cookies();
      const next = safeNextPath(store.get(NEXT_COOKIE)?.value);
      const res = NextResponse.redirect(`${origin}${next ?? "/"}`);
      if (next) res.cookies.delete(NEXT_COOKIE);
      return res;
    }
    message = error.message;
  }
  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(message ?? "No sign-in code received")}`);
}
