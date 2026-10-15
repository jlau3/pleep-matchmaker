"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadTop3TiersFor } from "@/app/actions";
import { BROWSE_PAGE_SIZE, BROWSE_SORT_HINTS, BROWSE_SORTS, type BrowseOptions, browseQuery, sortPlayers } from "@/lib/browse";
import { LOW_FIT_PCT } from "@/lib/fit";
import { LINES_BY_ID, linesFromIds } from "@/lib/lines";
import { type Relations, relationOf } from "@/lib/relations";
import type { MatchRow } from "@/lib/types";
import { BrowseLayout } from "./BrowseLayout";
import { FitLegend } from "./FitLegend";
import { FriendAction } from "./FriendAction";
import { LineChips } from "./LineChips";
import { MatchTile } from "./MatchTile";
import { PlayerHeader, playerName } from "./PlayerHeader";
import { FitWithTop3 } from "./Top3Tiers";

type Tiers = Record<string, Record<string, string>>;

/**
 * Find New's suggested players. Every player comes down once (browse_all), so
 * Good matches / Everyone, the sorts and the pages all switch here, with no
 * trip to the server; the URL follows along so a reload or a shared link
 * shows the same view. Your Top 3's tiers arrive for the first page with the
 * page, and for everyone else in the background (the Top 3 sort waits for
 * them if tapped first).
 */
export function FindNewBoard({
  rows,
  relations,
  tops,
  initial,
  initialTiers,
  allTiersLoaded,
  q,
  picked,
  friendsVoted,
}: {
  /** browse_all, Best match order. */
  rows: MatchRow[];
  relations: Relations;
  /** Your starred lines. */
  tops: string[];
  initial: BrowseOptions;
  /** Tiers already loaded (the first page's, or everyone's when the page opened sorted by Top 3). */
  initialTiers: Tiers;
  allTiersLoaded: boolean;
  /** The search box's query, kept in the URL. */
  q: string;
  /** How many lines you've voted Want or Don't Want on. */
  picked: number;
  friendsVoted: boolean;
}) {
  const [opts, setOpts] = useState<BrowseOptions>(initial);
  const [tiers, setTiers] = useState<Tiers>(initialTiers);
  // Players whose tiers are known (no entry for one of them = all dashes).
  const [known, setKnown] = useState<ReadonlySet<string> | "all">(allTiersLoaded ? "all" : new Set(Object.keys(initialTiers)));
  const [tierError, setTierError] = useState(false);
  const top = useRef<HTMLElement>(null);

  // Everyone's tiers, once, in the background.
  useEffect(() => {
    if (allTiersLoaded || tops.length === 0 || rows.length === 0) return;
    let live = true;
    loadTop3TiersFor(rows.map((r) => r.user_id))
      .then((all) => {
        if (!live) return;
        setTiers(all);
        setKnown("all");
      })
      .catch(() => live && setTierError(true));
    return () => {
      live = false;
    };
  }, [allTiersLoaded, tops.length, rows]);

  const tiersReady = known === "all";
  // Sorting by Top 3 before the tiers are in: keep Best match order until they are.
  const effectiveSort = opts.sort === "top3" && !tiersReady ? "fit" : opts.sort;
  const listed = useMemo(() => {
    const pool = opts.everyone ? rows : rows.filter((r) => r.good);
    return sortPlayers(pool, effectiveSort, tiers);
  }, [rows, opts.everyone, effectiveSort, tiers]);

  const total = listed.length;
  const pages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const page = Math.min(opts.page, pages);
  const shown = listed.slice((page - 1) * BROWSE_PAGE_SIZE, page * BROWSE_PAGE_SIZE);

  function change(next: Partial<BrowseOptions>, scroll = false) {
    const merged = { ...opts, page: 1, ...next };
    setOpts(merged);
    window.history.replaceState(window.history.state, "", `/matches${browseQuery(merged, q)}`);
    if (scroll) top.current?.scrollIntoView({ block: "start" });
  }

  const tiersOf = (id: string) => (known === "all" || known.has(id) ? { tops, tiers: tiers[id] } : null);

  return (
    <section ref={top} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">
          Suggested players {total > 0 && <span className="text-sm font-normal text-slate-500">{total}</span>}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Pill active={!opts.everyone} onClick={() => change({ everyone: false })}>
            Good matches
          </Pill>
          <Pill active={opts.everyone} onClick={() => change({ everyone: true })}>
            Everyone
          </Pill>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Sort</span>
          {BROWSE_SORTS.map(([id, label]) => (
            <Pill key={id} active={opts.sort === id} hint={BROWSE_SORT_HINTS[id]} onClick={() => change({ sort: id })}>
              {label}
            </Pill>
          ))}
        </div>
        {opts.sort === "top3" && !tiersReady && tops.length > 0 && (
          <p className="text-xs font-semibold text-slate-500" role="status">
            {tierError ? "Couldn't load Top 3 tiers. Reload to try again." : "Ranking by your Top 3…"}
          </p>
        )}
        <FitLegend friendsVoted={friendsVoted} youVoted={picked > 0} />
      </div>

      {picked === 0 && relations.friendIds.length === 0 && !opts.everyone ? (
        <p className="py-8 text-center text-slate-500">
          Add your friends (or <Link href="/vote" className="underline">vote</Link> on some lines) so we know what your
          group wants, or{" "}
          <button type="button" onClick={() => change({ everyone: true })} className="underline">
            see everyone
          </button>
          .
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {opts.everyone ? (
            "No one to suggest right now. Check back as more players join."
          ) : (
            <>
              No good matches yet (at least {LOW_FIT_PCT}% both ways and 3 of your wants on their Tier List).{" "}
              <button type="button" onClick={() => change({ everyone: true })} className="underline">
                See everyone
              </button>{" "}
              instead.
            </>
          )}
        </p>
      ) : (
        <BrowseLayout
          list={
            <ul className="space-y-4">
              {shown.map((match) => {
                const t = tiersOf(match.user_id);
                return (
                  <li key={match.user_id} className="card p-4">
                    <PlayerHeader
                      player={match}
                      aside={<FitWithTop3 they={match.match_pct} you={match.you_fit_pct} tops={t?.tops} tiers={t?.tiers} />}
                    />
                    <FitLists match={match} />
                    <NewPlayerNote match={match} name={playerName(match)} />
                    <div className="mt-4">
                      <FriendAction
                        userId={match.user_id}
                        name={playerName(match)}
                        relation={relationOf(relations, match.user_id)}
                        showsCode={Boolean(match.friend_code)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          }
          grid={
            <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((match) => (
                <MatchTile
                  key={match.user_id}
                  match={match}
                  relation={relationOf(relations, match.user_id)}
                  top3={tiersOf(match.user_id) ?? undefined}
                />
              ))}
            </ul>
          }
        />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between pt-2 text-sm">
          {page > 1 ? (
            <button type="button" onClick={() => change({ page: page - 1 }, true)} className="font-semibold underline">
              ← Previous
            </button>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <button type="button" onClick={() => change({ page: page + 1 }, true)} className="font-semibold underline">
              Next →
            </button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}

/** A filter or sort pill; the active one is filled. An optional hint shows on hover. */
function Pill({ active, onClick, hint, children }: { active: boolean; onClick: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-transparent bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
          : "border-slate-300 hover:bg-white/60 dark:border-slate-700 dark:hover:bg-night"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Why a player's numbers are dashes when it's on their side: they haven't
 * voted ("for them"), or fewer than 3 of their friends have ("for you").
 * Nothing is estimated in the meantime; the note says what's missing.
 */
function NewPlayerNote({ match, name }: { match: MatchRow; name: string }) {
  const noVotes = match.voted === false;
  const noList = (match.list_voters ?? 0) < 3;
  if (!noVotes && !noList) return null;
  const text =
    noVotes && noList
      ? `${name} hasn't voted yet and has fewer than 3 friends voting here, so their numbers aren't ready yet.`
      : noVotes
        ? `${name} hasn't voted yet, so "for them" isn't ready yet.`
        : `This user has fewer than 3 friends voting here, so "for you" isn't ready yet.`;
  return (
    <p className="mt-3 rounded-xl bg-sky/60 px-3 py-2 text-xs dark:bg-night-deep">
      <b>New here:</b> {text}
    </p>
  );
}

/**
 * Their Top 3 always shown, then a dropdown with both directions: what
 * they'd send you (your wants and don't-wants their friends want) and what
 * you'd send them (their wants and don't-wants your friends want).
 */
function FitLists({ match }: { match: MatchRow }) {
  const tops = match.top_wants ?? [];
  const chips = (ids: string[] | undefined) => (ids ?? []).flatMap((id) => LINES_BY_ID.get(id) ?? []);
  const toYou = { want: match.you_fit_wants ?? [], dont: match.you_fit_dont_wants ?? [] };
  const toThem = { want: match.fit_wants, dont: match.fit_dont_wants };
  // Votes are friends-only: a stranger's side comes back empty, so don't present it as "0 they want".
  const hidden = Boolean(match.votes_hidden);
  // Not friends yet (always, on Find New): their side is hidden, so only "They'd send you" is shown.
  const any = toYou.want.length + toYou.dont.length + (hidden ? 0 : toThem.want.length + toThem.dont.length) > 0;
  if (tops.length === 0 && !any) return null;
  const group = (title: string, color: string, ids: string[]) =>
    ids.length > 0 && (
      <div>
        <h5 className={`mb-2 text-sm font-semibold ${color}`}>{title}</h5>
        <LineChips lines={chips(ids)} />
      </div>
    );
  return (
    <div className="mt-3 space-y-3">
      {tops.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-sun-deep">★ Top {tops.length}</h4>
          <LineChips lines={linesFromIds(tops)} />
        </div>
      )}
      {any && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            They&apos;d send you {toYou.want.length} you want
            {!hidden && <> · You&apos;d send them {toThem.want.length} they want</>}
          </summary>
          <div className="mt-3 space-y-5">
            <div className="space-y-3">
              <h4 className="font-bold">They&apos;d send you</h4>
              {group("Your wants matching their friends' wants", "text-want", toYou.want)}
              {group("Your don't-wants matching their friends' wants", "text-dont", toYou.dont)}
              {toYou.want.length + toYou.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing you&apos;ve voted on is on their list yet.</p>
              )}
            </div>
            {!hidden && (
              <div className="space-y-3">
                <h4 className="font-bold">You&apos;d send them</h4>
                {group("Their wants matching your friends' wants", "text-want", toThem.want)}
                {group("Their don't-wants matching your friends' wants", "text-dont", toThem.dont)}
                {toThem.want.length + toThem.dont.length === 0 && (
                  <p className="text-sm text-slate-500">Nothing they&apos;ve voted on is on your list yet.</p>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
