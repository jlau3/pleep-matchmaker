import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const PROTECTED = ["/vote", "/friends", "/tiers", "/matches", "/profile", "/pick", "/collection", "/lookup", "/popular"];
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PROTECTED.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // "Last seen" = any logged-in visit. The cookie keeps it to one write per 10 minutes.
  if (user && !request.cookies.has(SEEN_COOKIE)) {
    await supabase.rpc("touch_last_seen");
    response.cookies.set(SEEN_COOKIE, "1", { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sprites/|api/keepalive|favicon.ico).*)"],
};
