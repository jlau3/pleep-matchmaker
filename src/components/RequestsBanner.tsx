import { getAuth } from "@/lib/supabase/server";
import type { RequestRow } from "@/lib/types";
import { playerName } from "./PlayerHeader";
import { RequestsBannerView } from "./RequestsBannerView";

/**
 * "Ann and 2 others sent you a friend request": shown on every page while a
 * request to you is open. Quietly absent when signed out or if the lookup
 * fails (e.g. before its migration).
 */
export async function RequestsBanner() {
  const { supabase, userId } = await getAuth();
  if (!userId) return null;
  const { data, error } = await supabase.rpc("get_friend_requests");
  if (error || !data?.length) return null;
  const names = (data as RequestRow[]).map((row) => playerName(row));
  return <RequestsBannerView names={names} />;
}
