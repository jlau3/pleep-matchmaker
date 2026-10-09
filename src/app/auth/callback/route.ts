import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase or Discord report failures as error/error_description params.
  let message = searchParams.get("error_description") ?? searchParams.get("error");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    message = error.message;
  }
  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(message ?? "No sign-in code received")}`);
}
