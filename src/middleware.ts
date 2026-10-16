import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const PROTECTED = ["/vote", "/friends", "/matches", "/profile", "/pick", "/collection", "/lookup", "/popular", "/feedback"];
const SEEN_COOKIE = "pm_seen";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims refreshes an expired session (writing new cookies via setAll) and
  // then verifies the JWT locally, instead of asking Supabase Auth every request.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  if (!user && PROTECTED.some((path) => request.nextUrl.pathname.startsWith(path))) {
    const target = new URL("/auth/required", request.url);
    target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const locked = NextResponse.rewrite(target);
    for (const cookie of response.cookies.getAll()) locked.cookies.set(cookie);
    return locked;
  }

  // "Last seen" = any logged-in visit. The cookie keeps it to one write per 10 minutes.
  if (user && !request.cookies.has(SEEN_COOKIE)) {
    await supabase.rpc("touch_last_seen");
    response.cookies.set(SEEN_COOKIE, "1", { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sprites/|islands/|og.png|logo.png|api/keepalive|api/kofi|favicon.ico).*)"],
};
