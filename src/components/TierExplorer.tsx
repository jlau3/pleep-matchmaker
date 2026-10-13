"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ISLANDS, LINES } from "@/lib/lines";
import { buildTiers, type LineVotes } from "@/lib/tiers";
import { InviteButton } from "./InviteButton";
import { InviteReminder } from "./InviteReminder";
import { RefreshStamp } from "./RefreshStamp";
import { TierBoard } from "./TierBoard";
import { TierExport } from "./TierExport";

export type Pool = "friends" | "everyone";

/** One pool's vote totals, as the server sends them. */
export interface PoolVotes {
  votes: Record<string, LineVotes>;
  /** Players in the pool with at least one want or don't-want. */
  voters: number;
  /** Everyone on your list, voted or not (friends pool only). */
  friendCount: number;
}

const POOL_LABEL: Record<Pool, string> = { friends: "My Friends", everyone: "Everyone" };
const MAPPED_ISLANDS = ISLANDS.filter((island) => island.lines.length > 0);

/**
 * The Tier List with every view ready up front: both pools (My Friends,
 * Everyone) by all islands and by island are built once from the vote totals
 * the page loaded, so the pills switch instantly with no server round trip.
 * The view goes in the URL (replaceState) so a reload or shared link opens it.
 */
export function TierExplorer({
  friends,
  everyone,
  initialPool,
  initialByIsland,
  loadedAt,
  notice,
}: {
  friends: PoolVotes;
  everyone: PoolVotes;
  initialPool: Pool;
  initialByIsland: boolean;
  /** When the server counted these votes (ISO), for "Updated 5m ago". */
  loadedAt: string;
  /** Shown under the heading (e.g. "3 new candies to vote on"). */
  notice?: React.ReactNode;
}) {
  const [pool, setPool] = useState<Pool>(initialPool);
  const [byIsland, setByIsland] = useState(initialByIsland && MAPPED_ISLANDS.length > 0);

  // Every view, built once per page load: [pool] -> { all, islands }.
  const views = useMemo(() => {
    const build = (data: PoolVotes) => {
      const votes = new Map(Object.entries(data.votes));
      return {
        all: buildTiers(votes, data.voters),
        islands: MAPPED_ISLANDS.map((island) => ({
          island,
          tiers: buildTiers(votes, data.voters, LINES.filter((line) => island.lines.includes(line.id))),
        })),
      };
    };
    return { friends: build(friends), everyone: build(everyone) };
  }, [friends, everyone]);

  function show(next: { pool?: Pool; byIsland?: boolean }) {
    const p = next.pool ?? pool;
    const split = next.byIsland ?? byIsland;
    setPool(p);
    setByIsland(split);
    const qs = new URLSearchParams();
    if (p === "everyone") qs.set("pool", "everyone");
    if (split) qs.set("split", "islands");
    const query = qs.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  const data = pool === "friends" ? friends : everyone;
  const view = views[pool];
  const poolLabel = POOL_LABEL[pool];
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-700"}`;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-2xl font-bold">Tier List</h1>
          <RefreshStamp loadedAt={loadedAt} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Which candy to prioritize, ranked by what {pool === "friends" ? "your friends" : `${data.voters} active players`}{" "}
          want and don&apos;t want.
        </p>
      </div>

      {notice}

      {pool === "friends" && data.voters > 0 && <InviteReminder friendCount={data.friendCount} />}

      <div className="flex flex-wrap items-center gap-2">
        {(["friends", "everyone"] as const).map((p) => (
          <button key={p} type="button" onClick={() => show({ pool: p })} aria-pressed={pool === p} className={pill(pool === p)}>
            {POOL_LABEL[p]}
          </button>
        ))}
        {data.voters > 0 && (
          <div className="ml-auto">
            <TierExport
              title={`${poolLabel} · ${byIsland ? "By Island" : "All Islands"}`}
              voters={data.voters}
              sections={
                byIsland
                  ? view.islands.map(({ island, tiers }) => ({ heading: island.name, tiers }))
                  : [{ tiers: view.all }]
              }
            />
          </div>
        )}
      </div>
      {MAPPED_ISLANDS.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => show({ byIsland: false })} aria-pressed={!byIsland} className={pill(!byIsland)}>
            All Islands
          </button>
          <button type="button" onClick={() => show({ byIsland: true })} aria-pressed={byIsland} className={pill(byIsland)}>
            By Island
          </button>
        </div>
      )}

      {data.voters === 0 ? (
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
          {view.islands.map(({ island, tiers }) => (
            <details key={island.id} className="card p-3">
              <summary className="font-semibold">{island.name}</summary>
              <div className="mt-3 space-y-3">
                <div className="flex justify-end">
                  <TierExport
                    title={`${poolLabel} · ${island.name}`}
                    voters={data.voters}
                    sections={[{ tiers }]}
                    label="Export this island"
                  />
                </div>
                <TierBoard tiers={tiers} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <TierBoard tiers={view.all} />
      )}
    </div>
  );
}
