import Link from "next/link";
import { LineChips } from "@/components/LineChips";
import { BrowseLayout } from "@/components/BrowseLayout";
import { MatchTile } from "@/components/MatchTile";
import { FitWithTop3 } from "@/components/Top3Tiers";
import { loadTop3Tiers, type Top3Tiers } from "@/lib/top3Tiers";
import { FriendAction } from "@/components/FriendAction";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { FriendshipLevel5 } from "@/components/FriendshipLevel5";
import { FitLegend } from "@/components/FitLegend";
import { LOW_FIT_PCT } from "@/lib/fit";
import { loadOwnProfile, loadOwnVotes, loadRelations, MAX_FRIENDS } from "@/lib/data";
import { relationOf } from "@/lib/relations";
import { LINES, LINES_BY_ID, linesFromIds } from "@/lib/lines";
import { BROWSE_PAGE_SIZE, BROWSE_SORT_HINTS, BROWSE_SORTS, browseQuery, parseBrowse } from "@/lib/browse";
import { requireUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";
import { withExtras } from "@/lib/extras";

type Params = { q?: string; sort?: string; show?: string; page?: string };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const opts = parseBrowse(params);
  const [{ choices, tops }, profile, relations, votedResult, matchesResult] = await Promise.all([
    loadOwnVotes(supabase, user.id),
    loadOwnProfile(supabase, user.id),
    loadRelations(supabase, user.id),
    supabase.rpc("my_friends_voted"),
    supabase.rpc("browse_players", {
      sort: opts.sort,
      everyone: opts.everyone,
      page_size: BROWSE_PAGE_SIZE,
      page_offset: (opts.page - 1) * BROWSE_PAGE_SIZE,
      // Tiers count every candy line, voted or not (the "Your Top 3" sort).
      line_count: LINES.length,
    }),
  ]);
  if (matchesResult.error) throw matchesResult.error;
  const matches = await withExtras(supabase, matchesResult.data as MatchRow[]);
  // Where each of your Top 3 sits on their Tier List, on every sort. browse_players carries it
  // (20261020000000_top3_fast.sql); before that migration, one more lookup.
  const top3: Top3Tiers | null =
    tops.length === 0
      ? null
      : matches.length > 0 && "top3_tiers" in matches[0]
        ? Object.fromEntries(matches.map((m) => [m.user_id, m.top3_tiers ?? {}]))
        : await loadTop3Tiers(supabase, matches.map((m) => m.user_id));
  // "For them" is a dash until a friend has voted (assume they have if the check isn't deployed yet).
  const friendsVoted = votedResult.error ? true : Boolean(votedResult.data);
  const total = Number(matches[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const link = (change: Partial<typeof opts>) => `/matches${browseQuery({ ...opts, page: 1, ...change }, q)}`;

  const picked = Object.values(choices).filter((c) => c !== "undecided").length;
  const unsorted = LINES.length - Object.keys(choices).length;

  // A shown Discord name lets friends find you even without an IGN (see the notice below).
  const shownDiscord = profile.show_discord ? profile.discord_username : null;

  const notices: React.ReactNode[] = [];
  if (!profile.ign && !shownDiscord)
    notices.push(
      <>
        Add your in-game name in <Link href="/profile" className="underline">Profile</Link> so friends can recognize and find
        you{profile.discord_username ? " (your Discord name is hidden)" : ""}.
      </>,
    );
  if (!profile.friend_code)
    notices.push(
      <>
        Add your friend code in <Link href="/profile" className="underline">Profile</Link> so others can find you.
      </>,
    );
  if (relations.friendIds.length >= MAX_FRIENDS)
    notices.push(
      <>
        Your friend list is full ({MAX_FRIENDS}/{MAX_FRIENDS}), so you're hidden from other people's matches.{" "}
        <Link href="/friends" className="underline">Remove someone</Link> to show up again.
      </>,
    );
  else if (!profile.open_to_friends)
    notices.push(
      <>
        You're hidden from other people's matches. Turn on "Open to new friends" in{" "}
        <Link href="/profile" className="underline">Profile</Link> when you have room.
      </>,
    );
  if (unsorted > 0 && picked > 0)
    notices.push(
      <>
        {unsorted} {unsorted === 1 ? "line isn't" : "lines aren't"} sorted yet.{" "}
        <Link href="/vote" className="underline">Vote on them</Link>
      </>,
    );

  return (
    <div className="space-y-4">
      <div>
        <SubTabs tabs={FRIENDS_TABS} active="/matches" />
        <PlayerSearch supabase={supabase} q={q} relations={relations} viewerId={user.id} />
        <div className="mt-4">
          <FriendPostCard {...friendPostProps(profile, choices, tops)} />
        </div>
      </div>
      {notices.map((notice, i) => (
        <p key={i} className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notice}
        </p>
      ))}

      <FriendshipLevel5 />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-lg font-semibold">
            Suggested players{" "}
            {total > 0 && <span className="text-sm font-normal text-slate-500">{total}</span>}
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Pills
              options={[
                [link({ everyone: false }), "Good matches", !opts.everyone],
                [link({ everyone: true }), "Everyone", opts.everyone],
              ]}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Sort</span>
            <Pills
              options={BROWSE_SORTS.map(([id, label]) => [link({ sort: id }), label, opts.sort === id, BROWSE_SORT_HINTS[id]])}
            />
          </div>
          <FitLegend friendsVoted={friendsVoted} youVoted={picked > 0} />
        </div>

        {picked === 0 && relations.friendIds.length === 0 && !opts.everyone ? (
          <p className="py-8 text-center text-slate-500">
            Add your friends (or <Link href="/vote" className="underline">vote</Link> on some lines) so we know what your
            group wants, or <Link href={link({ everyone: true })} className="underline">see everyone</Link>.
          </p>
        ) : matches.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            {opts.everyone ? (
              "No one to suggest right now. Check back as more players join."
            ) : (
              <>
                No good matches yet (at least {LOW_FIT_PCT}% both ways and 3 of your wants on their Tier List).{" "}
                <Link href={link({ everyone: true })} className="underline">See everyone</Link> instead.
              </>
            )}
          </p>
        ) : (
          <BrowseLayout
            list={
            <ul className="space-y-4">
              {matches.map((match) => (
                <li key={match.user_id} className="card p-4">
                  <PlayerHeader
                    player={match}
                    aside={
                      <FitWithTop3
                        they={match.match_pct}
                        you={match.you_fit_pct}
                        tops={top3 ? tops : undefined}
                        tiers={top3?.[match.user_id]}
                      />
                    }
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
              ))}
            </ul>
            }
            grid={
              <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {matches.map((match) => (
                  <MatchTile
                    key={match.user_id}
                    match={match}
                    relation={relationOf(relations, match.user_id)}
                    top3={top3 ? { tops, tiers: top3[match.user_id] } : undefined}
                  />
                ))}
              </ul>
            }
          />
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between pt-2 text-sm">
            {opts.page > 1 ? (
              <Link href={link({ ...opts, page: opts.page - 1 })} className="font-semibold underline">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Page {opts.page} of {pages}
            </span>
            {opts.page < pages ? (
              <Link href={link({ ...opts, page: opts.page + 1 })} className="font-semibold underline">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
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

/** A row of link pills; the active one is filled. An optional hint shows on hover. */
function Pills({ options }: { options: (readonly [string, string, boolean, string?])[] }) {
  return (
    <>
      {options.map(([href, label, active, hint]) => (
        <Link
          key={label}
          href={href}
          title={hint}
          scroll={false}
          aria-current={active ? "true" : undefined}
          className={`rounded-full border px-3 py-1 ${
            active
              ? "border-transparent bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
              : "border-slate-300 hover:bg-white/60 dark:border-slate-700 dark:hover:bg-night"
          }`}
        >
          {label}
        </Link>
      ))}
    </>
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
  // Friends-only votes: their side comes back empty, so don't present it as "0 they want".
  const hidden = Boolean(match.votes_hidden);
  const any = hidden || toYou.want.length + toYou.dont.length + toThem.want.length + toThem.dont.length > 0;
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
            They&apos;d send you {toYou.want.length} you want ·{" "}
            {hidden ? "Their votes are friends-only" : <>You&apos;d send them {toThem.want.length} they want</>}
          </summary>
          <div className="mt-3 space-y-5">
            <div className="space-y-3">
              <h4 className="font-bold">They&apos;d send you</h4>
              {group("Your wants matching their friends' wants", "text-want", toYou.want)}
              {group("Your don't-wants matching their friends' wants", "text-dont", toYou.dont)}
              {toYou.want.length + toYou.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing you've voted on is on their list yet.</p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-bold">You&apos;d send them</h4>
              {hidden && (
                <p className="text-sm text-slate-500">
                  They share their votes with friends only, so this shows once you&apos;re friends. Their % for them still
                  counts them.
                </p>
              )}
              {group("Their wants matching your friends' wants", "text-want", toThem.want)}
              {group("Their don't-wants matching your friends' wants", "text-dont", toThem.dont)}
              {!hidden && toThem.want.length + toThem.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing they've voted on is on your list yet.</p>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
