import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";
import { createClient } from "@/lib/supabase/server";
import { signInLanding } from "@/lib/signInLanding";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Where the magic-link email points (see the email template in the README):
 * /auth/confirm?token_hash=...&type=email. Verifying the token hash works in
 * any browser, unlike the code exchange in /auth/callback, which needs the
 * browser that asked for the link.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const store = await cookies();
      const next = safeNextPath(store.get(NEXT_COOKIE)?.value);
      const destination = await signInLanding(supabase, data.user?.id, next);
      const res = NextResponse.redirect(`${origin}${destination}`);
      if (next) res.cookies.delete(NEXT_COOKIE);
      return res;
    }
  }
  const message = "That sign-in link has expired or was already used. Ask for a new one.";
  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(message)}`);
}
