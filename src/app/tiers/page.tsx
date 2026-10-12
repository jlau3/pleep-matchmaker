import Link from "next/link";
import { TierBoard } from "@/components/TierBoard";
import { ISLANDS, LINES } from "@/lib/lines";
import { loadOwnChoices } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { buildTiers, countVotes, type LineVotes } from "@/lib/tiers";
import type { FriendRow, LineStatRow } from "@/lib/types";

type Pool = "friends" | "everyone";

export default async function TiersPage({ searchParams }: { searchParams: Promise<{ pool?: string; split?: string }> }) {
  const { supabase, user } = await requireUser();
  const unvoted = LINES.length - Object.keys(await loadOwnChoices(supabase, user.id)).length;
  const params = await searchParams;
  const pool: Pool = params.pool === "everyone" ? "everyone" : "friends";
  const mappedIslands = ISLANDS.filter((island) => island.lines.length > 0);
  const byIsland = params.split === "islands" && mappedIslands.length > 0;

  let votes: Map<string, LineVotes>;
  let voters: number;
  if (pool === "friends") {
    const { data, error } = await supabase.rpc("get_friends");
    if (error) throw error;
    const players = (data as FriendRow[]).filter((f) => f.visible && f.wants.length + f.dont_wants.length > 0);
    votes = countVotes(players);
    voters = players.length;
  } else {
    const [stats, count] = await Promise.all([supabase.rpc("get_line_stats"), supabase.rpc("get_voter_count")]);
    if (stats.error) throw stats.error;
    if (count.error) throw count.error;
    votes = new Map(
      (stats.data as LineStatRow[]).map((row) => [row.line_id, { wants: Number(row.wants), dontWants: Number(row.dont_wants) }]),
    );
    voters = Number(count.data);
  }

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
          Which candy to prioritize, ranked by net votes (wants minus don&apos;t-wants) from{" "}
          {pool === "friends" ? `your ${voters} ${voters === 1 ? "friend" : "friends"}` : `${voters} active players`}.
        </p>
      </div>

      {unvoted > 0 && (
        <Link
          href="/vote"
          className="block rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        >
          {unvoted} {unvoted === 1 ? "candy" : "candies"} to vote on →
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={href({ pool: "friends" })} className={pill(pool === "friends")}>
          My friends
        </Link>
        <Link href={href({ pool: "everyone" })} className={pill(pool === "everyone")}>
          Everyone
        </Link>
      </div>
      {mappedIslands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ byIsland: false })} className={pill(!byIsland)}>
            All islands
          </Link>
          <Link href={href({ byIsland: true })} className={pill(byIsland)}>
            By island
          </Link>
        </div>
      )}

      {voters === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> to build your tier list.
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
