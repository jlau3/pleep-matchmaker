import Link from "next/link";
import { FriendButton } from "@/components/FriendButton";
import { IslandGroups } from "@/components/IslandGroups";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { linesFromIds } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import { tally } from "@/lib/tally";
import type { FriendRow } from "@/lib/types";

const MAX_FRIENDS = 50;

export default async function FriendsPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_friends");
  if (error) throw error;
  const friends = data as FriendRow[];
  const visible = friends.filter((f) => f.visible);
  const wanted = tally(visible.map((f) => f.wants));
  const unwanted = tally(visible.map((f) => f.dont_wants));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {friends.length} / {MAX_FRIENDS} friends. Add people from{" "}
          <Link href="/lookup" className="underline">Look up</Link> or{" "}
          <Link href="/matches" className="underline">Find friends</Link>.
        </p>
      </div>

      {friends.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          No friends added yet. <Link href="/lookup" className="underline">Look someone up</Link> by IGN or friend code.
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-1 text-lg font-semibold text-want">Most wanted by your friends</h2>
            <p className="mb-3 text-xs text-slate-500">Number = how many friends want that candy.</p>
            <IslandGroups lines={wanted.lines} counts={wanted.counts} />
          </section>

          <details>
            <summary className="cursor-pointer text-lg font-semibold text-dont">Least wanted by your friends</summary>
            <div className="mt-3">
              <IslandGroups lines={unwanted.lines} counts={unwanted.counts} />
            </div>
          </details>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Your friends</h2>
            <ul className="space-y-3">
              {friends.map((friend) => (
                <li key={friend.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  {friend.visible ? (
                    <>
                      <PlayerHeader player={friend} isFriend />
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Wants {friend.wants.length} · doesn't want {friend.dont_wants.length}
                        </summary>
                        <div className="mt-3 space-y-4">
                          <IslandGroups lines={linesFromIds(friend.wants)} />
                          <div>
                            <h4 className="mb-2 text-sm font-semibold text-dont">Doesn't want</h4>
                            <IslandGroups lines={linesFromIds(friend.dont_wants)} />
                          </div>
                        </div>
                      </details>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <strong>{playerName(friend)}</strong>
                        <span className="ml-2 text-slate-500">has made their list private</span>
                      </span>
                      <FriendButton userId={friend.user_id} isFriend />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
