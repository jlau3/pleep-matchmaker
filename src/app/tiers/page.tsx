import Link from "next/link";
import { InviteButton } from "@/components/InviteButton";
import { InviteReminder } from "@/components/InviteReminder";
import { TierBoard } from "@/components/TierBoard";
import { ISLANDS, LINES } from "@/lib/lines";
import { countOwnVotes } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { loadCommunityStats } from "@/lib/communityStats";
import { buildTiers, countVotes, type LineVotes } from "@/lib/tiers";
import type { FriendRow } from "@/lib/types";

type Pool = "friends" | "everyone";

export default async function TiersPage({ searchParams }: { searchParams: Promise<{ pool?: string; split?: string }> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const pool: Pool = params.pool === "everyone" ? "everyone" : "friends";
  const mappedIslands = ISLANDS.filter((island) => island.lines.length > 0);
  const byIsland = params.split === "islands" && mappedIslands.length > 0;

  // Both lookups at once: each is a round trip to Supabase, and the page waits on the slower one only.
  const [votedCount, pooled] = await Promise.all([
    countOwnVotes(supabase, user.id),
    pool === "friends"
      ? // Votes only: skip the per-friend fit %, which only My Friends shows.
        supabase.rpc("get_friends", { with_match: false }).then(({ data, error }) => {
          if (error) throw error;
          const rows = data as FriendRow[];
          const players = rows.filter((f) => f.visible && f.wants.length + f.dont_wants.length > 0);
          return { votes: countVotes(players), voters: players.length, friendCount: rows.length };
        })
      : loadCommunityStats(supabase).then((community) => ({
          votes: new Map(Object.entries(community.votes)) as Map<string, LineVotes>,
          voters: community.voters,
          friendCount: 0,
        })),
  ]);
  const unvoted = Math.max(0, LINES.length - votedCount);
  const { votes, voters, friendCount } = pooled;

  const href = (next: { pool?: Pool; byIsland?: boolean }) => {
    const p = new URLSearchParams();
    if ((next.pool ?? pool) === "everyone") p.set("pool", "everyone");
    if (next.byIsland ?? byIsland) p.set("split", "islands");
    const qs = p.toString();
    return qs ? `/tiers?${qs}` : "/tiers";
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? "pill-active border-transparent"
        : "border-slate-300 dark:border-slate-700"
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Tier List</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Which candy to prioritize, ranked by what{" "}
          {pool === "friends" ? "your friends" : `${voters} active players`} want and don&apos;t want.
        </p>
      </div>

      {unvoted > 0 && (
        <Link
          href="/vote"
          className="block rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        >
          {unvoted} new {unvoted === 1 ? "candy" : "candies"} to vote on →
        </Link>
      )}

      {pool === "friends" && voters > 0 && <InviteReminder friendCount={friendCount} />}

      <div className="flex flex-wrap gap-2">
        <Link href={href({ pool: "friends" })} className={pill(pool === "friends")}>
          My Friends
        </Link>
        <Link href={href({ pool: "everyone" })} className={pill(pool === "everyone")}>
          Everyone
        </Link>
      </div>
      {mappedIslands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ byIsland: false })} className={pill(!byIsland)}>
            All Islands
          </Link>
          <Link href={href({ byIsland: true })} className={pill(byIsland)}>
            By Island
          </Link>
        </div>
      )}

      {voters === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> or invite them to
              build your tier list.
              <span className="mt-4 block">
                <InviteButton />
              </span>
            </>
          ) : (
            "No votes yet."
          )}
        </p>
      ) : byIsland ? (
          <div className="space-y-3">
            {mappedIslands.map((island) => {
              const tiers = buildTiers(votes, voters, LINES.filter((line) => island.lines.includes(line.id)));
              const top = (["S", "A"] as const).map((t) => `${tiers.get(t)!.length} ${t}`).join(" · ");
              return (
                <details key={island.id} className="card p-3">
                  <summary className="flex items-center justify-between gap-3 font-semibold">
                    {island.name}
                    <span className="text-sm font-normal text-slate-500">{top}</span>
                  </summary>
                  <div className="mt-3">
                    <TierBoard tiers={tiers} />
                  </div>
                </details>
              );
            })}
          </div>
      ) : (
        <TierBoard tiers={buildTiers(votes, voters)} />
      )}
    </div>
  );
}
