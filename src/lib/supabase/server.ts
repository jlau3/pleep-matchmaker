import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * One Supabase client and signed-in user id per request, shared by the page,
 * the nav and anything else that asks (React cache). getClaims() verifies the
 * session JWT locally against the project's published signing keys, so no
 * round trip to Supabase Auth; with a legacy shared-secret (HS256) project it
 * falls back to one getUser() call.
 */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
});

/** Supabase client plus the signed-in user; redirects to the landing page if signed out. */
export async function requireUser() {
  const { supabase, userId } = await getAuth();
  if (!userId) redirect("/");
  return { supabase, user: { id: userId } };
}
