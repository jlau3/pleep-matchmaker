"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSleepType, ISLANDS, LINES, SLEEP_TYPE_LABEL, lineSpriteUrl, sleepTypeMember, spriteUrl, type SleepType } from "@/lib/lines";
import { buildTiers, buildPublicTiers, parseTierStyle, TIER_STYLE_LABEL, TIER_STYLES, TIER_STYLE_DESCRIPTION, RANK_MIN_SEEN, type TierStyle, type LineVotes, type UnrankedLine } from "@/lib/tiers";
import { InviteButton } from "./InviteButton";
import { InviteReminder } from "./InviteReminder";
import { RefreshStamp } from "./RefreshStamp";
import { TierBoard } from "./TierBoard";
import { CandyFilters } from "./CandyFilters";
import { TierGuide } from "./TierGuide";
import { RANKING_PENDING, TierExport } from "./TierExport";
import { NEW_CARD, NewTag } from "./TierBoard";
import { useSignIn } from "./SignInSheet";

export type Pool = "friends" | "everyone";

/** One pool's vote totals, as the server sends them. */
export interface PoolVotes {
  votes: Record<string, LineVotes>;
  /** Active players with saved choices (non-Neutral choices required only in the friends pool). */
  voters: number;
  /** Everyone on your list, voted or not (friends pool only). */
  friendCount: number;
  /** Missing lines have too few votes and must never be assigned a tier. */
  thresholded?: boolean;
}

/** Last view (pool, island, sleep type), so leaving the Tier List and coming back keeps it. */
const VIEW_KEY = "pm_tiers_view";
/** Last ranking style picked. Kept apart from the view: a link without ?style= doesn't reset it. */
const STYLE_KEY = "pm_tiers_style";
const saveStyle = (style: TierStyle) => {
  try { localStorage.setItem(STYLE_KEY, style); } catch { /* Not remembered; fine. */ }
};

const POOL_LABEL: Record<Pool, string> = { friends: "My Friends", everyone: "Global" };
const MAPPED_ISLANDS = ISLANDS.filter((island) => island.lines.length > 0);

/**
 * The Tier List with every view ready up front: both pools (My Friends,
 * Everyone) by island and sleep type come straight from the vote totals the
 * page loaded, so the pickers switch instantly with no server round trip.
 * The view goes in the URL (replaceState) so a reload or shared link opens it,
 * and in localStorage so coming back from another tab (no query) reopens it.
 */
export function TierExplorer({
  friends,
  everyone,
  initialPool,
  initialIsland,
  initialSleep,
  initialStyle = "standard",
  loadedAt,
  notice,
  signedIn = true,
  viewerId = null,
  everyoneSnapshot,
}: {
  friends: PoolVotes;
  everyone: PoolVotes;
  initialPool: Pool;
  /** Island id to open on (?island=), or null for all islands. */
  initialIsland: string | null;
  /** Sleep type to open on (?sleep=), or null for all. */
  initialSleep: SleepType | null;
  initialStyle?: TierStyle;
  /** When the server counted these votes (ISO), for "Updated 5m ago". */
  loadedAt: string;
  /** Shown under the heading (e.g. "3 new candies to vote on"). */
  notice?: React.ReactNode;
  signedIn?: boolean;
  viewerId?: string | null;
  everyoneSnapshot?: { exportedAt: string; candies: number };
}) {
  const styleMenu = useRef<HTMLDetailsElement>(null);
  const [menuPlacement, setMenuPlacement] = useState({ above: false, maxHeight: 480 });
  const placeStyleMenu = useCallback(() => {
    const menu = styleMenu.current;
    if (!menu?.open) return;
    const rect = menu.querySelector("summary")!.getBoundingClientRect();
    const height = window.innerHeight;
    const below = Math.max(0, height - rect.bottom - 24);
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const above = Math.max(0, rect.top - Math.max(24, headerBottom + 24));
    const openAbove = below < Math.min(360, height * 0.7) && above > below;
    setMenuPlacement({ above: openAbove, maxHeight: Math.max(80, Math.min(480, height * 0.7, openAbove ? above : below)) });
  }, []);
  useEffect(() => {
    window.addEventListener("resize", placeStyleMenu);
    window.addEventListener("scroll", placeStyleMenu, true);
    return () => {
      window.removeEventListener("resize", placeStyleMenu);
      window.removeEventListener("scroll", placeStyleMenu, true);
    };
  }, [placeStyleMenu]);
  const tourRoot = useRef<HTMLDivElement>(null);
  const openSignIn = useSignIn();
  const viewKey = signedIn ? VIEW_KEY : `${VIEW_KEY}_public`;
  const [pool, setPool] = useState<Pool>(signedIn ? initialPool : "everyone");
  const [islandId, setIslandId] = useState(
    MAPPED_ISLANDS.some((island) => island.id === initialIsland) ? initialIsland : null,
  );

  const [style, setStyle] = useState<TierStyle>(initialStyle);
  const [sleepType, setSleepType] = useState<SleepType | null>(initialSleep);

  // Plain /tiers (from the nav): reopen the last view. A link with its own query wins, and
  // becomes the view to reopen (e.g. the first-friend note's link to My Friends).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!signedIn && params.get("pool") === "friends") {
      openSignIn(`/tiers${window.location.search}`);
    }
    // An explicit ?style= wins and is remembered; otherwise reopen the last style picked.
    let remembered: TierStyle = style;
    if (params.has("style")) saveStyle(style);
    else {
      try {
        const saved = localStorage.getItem(STYLE_KEY);
        if (saved && parseTierStyle(saved) === saved) remembered = saved as TierStyle;
      } catch {
        /* Storage unavailable: keep the default style. */
      }
    }
    if (window.location.search) {
      if (remembered !== style) show({ style: remembered });
      try {
        localStorage.setItem(viewKey, JSON.stringify({ pool, island: islandId, sleep: sleepType }));
      } catch {
        /* Not remembered; fine. */
      }
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey) ?? "null");
      if (!saved || typeof saved !== "object") {
        if (remembered !== style) show({ style: remembered });
        return;
      }
      show({
        style: remembered,
        pool: !signedIn || saved.pool === "everyone" ? "everyone" : "friends",
        island: MAPPED_ISLANDS.some((island) => island.id === saved.island) ? saved.island : null,
        sleep: isSleepType(saved.sleep) ? saved.sleep : null,
      });
    } catch {
      /* Storage unavailable or bad JSON: keep the default view. */
    }
    // Once, on arrival.
  }, []);

  function show(next: { pool?: Pool; island?: string | null; sleep?: SleepType | null; style?: TierStyle }) {
    if (!signedIn && next.pool === "friends") {
      const query = new URLSearchParams({ pool: "friends" });
      if (islandId) query.set("island", islandId);
      if (sleepType) query.set("sleep", sleepType);
      if (style !== "standard") query.set("style", style);
      openSignIn(`/tiers?${query}`);
      return;
    }
    const p = next.pool ?? pool;
    const id = next.island !== undefined ? next.island : islandId;
    const sleep = next.sleep !== undefined ? next.sleep : sleepType;
    const rankingStyle = next.style ?? style;
    if (next.style) saveStyle(next.style);
    setStyle(rankingStyle);
    setPool(p);
    setIslandId(id);
    setSleepType(sleep);
    const qs = new URLSearchParams();
    qs.set("pool", p);
    qs.set("style", rankingStyle);
    if (id) qs.set("island", id);
    if (sleep) qs.set("sleep", sleep);
    const query = qs.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    try {
      localStorage.setItem(viewKey, JSON.stringify({ pool: p, island: id, sleep }));
    } catch {
      /* Not remembered; fine. */
    }
  }

  const data = pool === "friends" ? friends : everyone;
  const poolLabel = POOL_LABEL[pool];
  const selected = MAPPED_ISLANDS.find((island) => island.id === islandId) ?? null;
  // A hundred-odd lines: cheap enough to rank per pick, no need to prebuild every combination.
  // With a sleep type picked, a line shows if a form that spawns here sleeps that way, drawn as that form.
  const { tiers, unranked } = useMemo(() => {
    const shown = new Map<string, string | undefined>();
    for (const line of LINES) {
      if (selected && !selected.lines.includes(line.id)) continue;
      if (!sleepType) shown.set(line.id, undefined);
      else {
        const member = sleepTypeMember(line, sleepType, selected);
        if (member) {
          const sprite = spriteUrl(member.sprite);
          shown.set(line.id, sprite === lineSpriteUrl(line) ? undefined : sprite);
        }
      }
    }
    const lines = LINES.filter((line) => shown.has(line.id));
    const votes = new Map(Object.entries(data.votes));
    const { tiers: built, unranked } = data.thresholded
      ? buildPublicTiers(votes, data.voters, lines, style)
      : { tiers: buildTiers(votes, data.voters, lines, style), unranked: [] as UnrankedLine[] };
    for (const rows of built.values()) for (const r of rows) r.sprite = shown.get(r.line.id);
    for (const row of unranked) row.sprite = shown.get(row.line.id);
    return { tiers: built, unranked };
  }, [data, selected, sleepType, style]);
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "pill-idle border-slate-300 dark:border-slate-700"}`;

  return (
    <div ref={tourRoot} className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-2xl font-bold">Tier List</h1>
          {pool === "everyone" && everyoneSnapshot
            ? <span className="text-xs text-slate-500">Snapshot: {everyoneSnapshot.exportedAt.slice(0, 10)}</span>
            : <RefreshStamp loadedAt={loadedAt} />}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {style === "consensus" ? "How preferences differ, grouped by votes from" : "Which candy to prioritize, ranked by votes from"}{" "}
          {pool === "friends" ? "your friends" : "active players"}.
        </p>
        {!signedIn && <button type="button" onClick={() => show({ pool: "friends" })} className="mt-2 text-sm font-semibold underline">See what your friends want → Sign in</button>}
      </div>

      {pool === "everyone" && everyoneSnapshot && <p role="status" className="rounded-xl bg-sky/60 px-3 py-2 text-sm dark:bg-night-deep">
        Dev snapshot: {everyone.voters} players · {everyoneSnapshot.candies} candies. Imported totals for comparing styles; My Friends uses your dev friends.
      </p>}
      <TierGuide root={tourRoot} signedIn={signedIn} />

      {notice}

      {pool === "friends" && data.voters > 0 && <InviteReminder friendCount={data.friendCount} />}

      <div className="flex flex-wrap items-center gap-2">
        <div data-tier-tour="pool" className="flex flex-wrap items-center gap-2">
          {(["everyone", "friends"] as const).map((p) => (
            <button key={p} type="button" onClick={() => show({ pool: p })} aria-pressed={pool === p} className={pill(pool === p)}>
              {POOL_LABEL[p]}{!signedIn && p === "friends" && <span aria-hidden="true" className="ml-1">🔒</span>}
            </button>
          ))}
        </div>
        {(data.voters > 0 || data.thresholded) && (
          <div data-tier-tour="export" className="ml-auto">
            <TierExport
              title={[everyoneSnapshot && pool === "everyone" && `Dev Snapshot ${everyoneSnapshot.exportedAt.slice(0, 10)}`, poolLabel, TIER_STYLE_LABEL[style], selected ? selected.name : "All Islands", sleepType && SLEEP_TYPE_LABEL[sleepType]]
                .filter(Boolean)
                .join(" · ")}
              voters={data.voters || null}
              sections={[{ tiers, unranked }]}
              style={style}
            />
          </div>
        )}
      </div>

      <CandyFilters islandId={islandId} sleepType={sleepType} onIsland={(island) => show({ island })} onSleep={(sleep) => show({ sleep })} tour>
        <details ref={styleMenu} onToggle={placeStyleMenu} data-tier-tour="style" className="relative ml-auto max-w-full text-sm">
          <summary className="pill-idle w-fit cursor-pointer rounded-xl border border-slate-300 px-3 py-2 font-semibold dark:border-slate-700">Ranking Style: {TIER_STYLE_LABEL[style]}</summary>
          <div style={{ maxHeight: menuPlacement.maxHeight }} className={`absolute right-0 z-20 ${menuPlacement.above ? "bottom-full mb-2" : "top-full mt-2"} w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-300 bg-cream p-3 shadow-lg dark:border-slate-700 dark:bg-night`}>
            <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend className="mb-2 w-full p-0 font-semibold">Choose a ranking style</legend>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p><b>Score:</b> to a friend, a Wanted candy is worth 3, a Neutral one 1 and a Don&apos;t Want 0. We average that over {pool === "everyone" ? "the players who have seen it" : "your voting friends"} and show it on a scale where 0 is as good as everyone Neutral and 100 is everyone Wanting it.</p>
                <p><b>F</b> (Percentile and Fixed Scores): below 0, meaning more than twice as many Don&apos;t Want votes as Want votes.</p>
              </div>
              {TIER_STYLES.map((option) => <label key={option} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="tier-style" value={option} checked={style === option}
                  onChange={() => show({ style: option })} className="mt-1 shrink-0 accent-want" />
                <span className="min-w-0"><b>{TIER_STYLE_LABEL[option]}</b>
                  <span className="block text-xs text-slate-500">{TIER_STYLE_DESCRIPTION[option]}</span></span>
              </label>)}
            </fieldset>
          </div>
        </details>
      </CandyFilters>


      {data.voters === 0 && !data.thresholded ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> or invite them to
              build your Tier List.
              <span className="mt-4 block">
                <InviteButton />
              </span>
            </>
          ) : (
            "No votes yet."
          )}
        </p>
      ) : (
        <>
          {Array.from(tiers.values()).some((rows) => rows.length > 0) && <TierBoard tiers={tiers} pool={pool} style={style} />}
          {unranked.length > 0 && <section className="card p-4" aria-label={RANKING_PENDING}>
            <h2 className="font-bold">{RANKING_PENDING}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Candy is ranked once {RANK_MIN_SEEN} active players have seen it. Vote counts show from 10.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unranked.map(({ line, sprite, isNew, counts }) => <li key={line.id} className={`flex items-center gap-3 rounded-2xl bg-white p-2 dark:bg-night-deep ${isNew ? NEW_CARD : ""}`}>
                <img src={sprite ?? lineSpriteUrl(line)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full bg-sky object-contain dark:bg-night" />
                <div className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold">{line.name}</span>{isNew && <NewTag />}</span>
                  {counts ? (
                    <span className="flex flex-wrap gap-x-2 text-xs">
                      <span className="text-want">{counts.wants} Want</span>
                      <span className="text-meh">{counts.neutral} Neutral</span>
                      <span className="text-dont">{counts.dontWants} Don&apos;t Want</span>
                      <span className="text-slate-500">· {counts.seen} of {RANK_MIN_SEEN} so far</span>
                    </span>
                  ) : <span className="text-xs text-slate-500">Fewer than 10 votes so far</span>}
                </div>
              </li>)}
            </ul>
          </section>}
        </>
      )}
    </div>
  );
}
