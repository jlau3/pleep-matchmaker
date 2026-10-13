import Link from "next/link";
import { LineChips } from "@/components/LineChips";
import { ConnectSteps } from "@/components/ConnectSteps";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { FriendPostCard } from "@/components/FriendPostCard";
import { FriendshipLevel5 } from "@/components/FriendshipLevel5";
import { FitPair } from "@/components/FitPair";
import { LOW_FIT_PCT } from "@/lib/fit";
import { loadFriendIds, loadOwnProfile, loadOwnVotes, MAX_FRIENDS } from "@/lib/data";
import { LINES, LINES_BY_ID, linesFromIds } from "@/lib/lines";
import { BROWSE_PAGE_SIZE, BROWSE_SORT_HINTS, BROWSE_SORTS, browseQuery, parseBrowse } from "@/lib/browse";
import { requireUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";

type Params = { q?: string; sort?: string; show?: string; page?: string };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const opts = parseBrowse(params);
  const [{ choices, tops }, profile, friendIds, matchesResult] = await Promise.all([
    loadOwnVotes(supabase, user.id),
    loadOwnProfile(supabase, user.id),
    loadFriendIds(supabase, user.id),
    supabase.rpc("browse_players", {
      sort: opts.sort,
      everyone: opts.everyone,
      page_size: BROWSE_PAGE_SIZE,
      page_offset: (opts.page - 1) * BROWSE_PAGE_SIZE,
    }),
  ]);
  if (matchesResult.error) throw matchesResult.error;
  const matches = matchesResult.data as MatchRow[];
  const total = Number(matches[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const link = (change: Partial<typeof opts>) => `/matches${browseQuery({ ...opts, page: 1, ...change }, q)}`;

  const picked = Object.values(choices).filter((c) => c !== "undecided").length;
  const unsorted = LINES.length - Object.keys(choices).length;

  // The Discord name only goes in the friend post if the player shows it.
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
  if (friendIds.size >= MAX_FRIENDS)
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
        <SubTabs tabs={FRIENDS_TABS} active="/matches" query={q ? `q=${encodeURIComponent(q)}` : undefined} />
        <PlayerSearch supabase={supabase} q={q} friendIds={friendIds} viewerId={user.id} />
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Players open to new friends who are sending candies you want.
        </p>
        <div className="mt-2">
          <FriendshipLevel5 />
        </div>
      </div>
      {notices.map((notice, i) => (
        <p key={i} className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notice}
        </p>
      ))}

      <FriendPostCard
        friendCode={profile.friend_code}
        handle={shownDiscord ? `@${shownDiscord}` : profile.ign}
        searchName={shownDiscord ?? profile.ign}
        topNames={linesFromIds(tops).map((line) => line.name)}
        wantNames={linesFromIds(Object.keys(choices).filter((id) => choices[id] === "want"))
          .sort((a, b) => b.weight - a.weight || a.dex - b.dex)
          .slice(0, 3)
          .map((line) => line.name)}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-lg font-semibold">
            Suggested players{" "}
            {total > 0 && <span className="text-sm font-normal text-slate-500">{total}</span>}
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Pills
              options={[
                [link({ everyone: false }), "Good fits", !opts.everyone],
                [link({ everyone: true }), "Everyone", opts.everyone],
              ]}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Sort</span>
            <Pills options={BROWSE_SORTS.map(([id, label]) => [link({ sort: id }), label, opts.sort === id])} />
          </div>
          <p className="text-xs text-slate-500">{BROWSE_SORT_HINTS[opts.sort]}</p>
        </div>

        {picked === 0 && friendIds.size === 0 && !opts.everyone ? (
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
                No good fits yet (at least {LOW_FIT_PCT}% both ways and 3 of your wants on their Tier List).{" "}
                <Link href={link({ everyone: true })} className="underline">See everyone</Link> instead.
              </>
            )}
          </p>
        ) : (
          <ul className="space-y-4">
            {matches.map((match) => (
              <li key={match.user_id} className="card p-4">
                <PlayerHeader player={match} aside={<FitPair they={match.match_pct} you={match.you_fit_pct} />} />
                <FitLists match={match} />
                {match.match_pct === null && match.you_fit_pct == null && (
                  <p className="mt-3 text-sm text-slate-500">Hasn&apos;t voted on any candy yet.</p>
                )}
                <div className="mt-4">
                  <ConnectSteps userId={match.user_id} friendCode={match.friend_code} name={playerName(match)} />
                </div>
              </li>
            ))}
          </ul>
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

/** A row of link pills; the active one is filled. */
function Pills({ options }: { options: (readonly [string, string, boolean])[] }) {
  return (
    <>
      {options.map(([href, label, active]) => (
        <Link
          key={label}
          href={href}
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
  const any = toYou.want.length + toYou.dont.length + toThem.want.length + toThem.dont.length > 0;
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
            They&apos;d send you {toYou.want.length} you want · You&apos;d send them {toThem.want.length} they want
          </summary>
          <div className="mt-3 space-y-5">
            <div className="space-y-3">
              <h4 className="font-bold">They&apos;d send you</h4>
              {group("Your wants their friends want", "text-want", toYou.want)}
              {group("Your don't-wants their friends want", "text-dont", toYou.dont)}
              {toYou.want.length + toYou.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing you've voted on is on their list yet.</p>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-bold">You&apos;d send them</h4>
              {group("Their wants your friends want", "text-want", toThem.want)}
              {group("Their don't-wants your friends want", "text-dont", toThem.dont)}
              {toThem.want.length + toThem.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing they've voted on is on your list yet.</p>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
