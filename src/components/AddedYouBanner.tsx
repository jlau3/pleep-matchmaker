import { getAuth } from "@/lib/supabase/server";
import type { AddedMeRow } from "@/lib/types";
import { playerName } from "./PlayerHeader";
import { AddedYouBannerView } from "./AddedYouBannerView";

/**
 * "Ann and 2 others added you as a friend": shown on every page while someone
 * who added you is waiting for you to add them back or dismiss them. Quietly
 * absent when signed out or if the lookup fails (e.g. before its migration).
 */
export async function AddedYouBanner() {
  const { supabase, userId } = await getAuth();
  if (!userId) return null;
  const { data, error } = await supabase.rpc("get_added_me");
  if (error || !data?.length) return null;
  const names = (data as AddedMeRow[]).map((row) => playerName(row));
  return <AddedYouBannerView names={names} />;
}
