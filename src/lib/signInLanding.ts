import type { SupabaseClient } from "@supabase/supabase-js";
import { safeNextPath } from "./nextPath";

/** New players start on Profile; returning players use their shared link or Tier List. */
export async function signInLanding(supabase: SupabaseClient, userId: string | undefined, next?: string | null): Promise<string> {
  if (userId) {
    const { data, error } = await supabase.from("profiles").select("help_seen_version, setup_done").eq("id", userId).maybeSingle();
    if (!error && data?.help_seen_version === 0 && data.setup_done === false) return "/profile?setup=profile";
  }
  return safeNextPath(next) ?? "/tiers";
}
