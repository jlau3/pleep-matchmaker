-- Your Top 3 on other players' Tier Lists. For any player, each of your
-- starred lines gets the tier (S/A/B/C/Avoid) it has on THEIR Tier List: the
-- same rules as src/lib/tiers.ts (buildTiers), from their friends' votes.
-- Shown on Find New (with the new "Your Top 3" sort) and on My Friends.
--
-- The tiers depend on every candy line, voted or not, and the line catalogue
-- lives in the app, so callers pass line_count (LINES.length); lines nobody
-- voted on all score as Neutral. Tier edges use float8 like the app's
-- Math.ceil(share * n), so both agree to the line. Safe to re-run.

-- Tier of every line on player's Tier List (their friends who've voted, as on
-- the Tier List page). line_id '' stands for all the lines nobody voted on.
-- Empty when none of their friends has voted.
create or replace function public.list_tiers(player uuid, line_count int)
returns table (line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  voters as (
    select f.friend_id
    from public.friends f
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    where f.user_id = player
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice <> 'undecided')
  ),
  nv as (select count(*)::int as n from voters),
  votes as (
    select p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d
    from public.preferences p
    join voters v on v.friend_id = p.user_id
    where p.choice <> 'undecided'
    group by p.line_id
  ),
  -- POINTS: Want +3, Neutral +1 (everyone else), Don't Want -3. cnt: how many lines share the row.
  scored as (
    select vo.line_id, 3 * vo.w + (nv.n - vo.w - vo.d) - 3 * vo.d as score, 1 as cnt
    from votes vo, nv
    union all
    select '', nv.n, greatest(line_count - (select count(*) from votes)::int, 0)
    from nv
    where line_count > (select count(*) from votes)
  ),
  runs as (select s.score, sum(s.cnt)::int as size from scored s where s.score >= 0 group by s.score),
  pos as (
    select r.score, r.size,
      coalesce(sum(r.size) over (order by r.score desc rows between unbounded preceding and 1 preceding), 0)::int as start,
      sum(r.size) over ()::int as n
    from runs r
  ),
  -- A run of tied lines takes the tier of its middle position; the best run is always S.
  tiered as (
    select p.score,
      case
        when p.start = 0 then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8) * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8 + 0.3::float8) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  select s.line_id, case when s.score < 0 then 'Avoid' else t.tier end
  from scored s
  left join tiered t on t.score = s.score
  where (select n from nv) > 0
$$;
revoke execute on function public.list_tiers(uuid, int) from public, anon, authenticated;

-- The viewer's starred lines with their tier on player's Tier List. Empty when
-- player has no list (no friend has voted).
create or replace function public.top3_tiers_for(player uuid, viewer uuid, line_count int)
returns table (line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with lt as (select * from public.list_tiers(player, line_count))
  select p.line_id, coalesce(
    (select lt.tier from lt where lt.line_id = p.line_id),
    (select lt.tier from lt where lt.line_id = '')
  )
  from public.preferences p
  where p.user_id = viewer and p.top
    and exists (select 1 from lt)
$$;
revoke execute on function public.top3_tiers_for(uuid, uuid, int) from public, anon, authenticated;

-- For the cards: your Top 3's tiers on each of these players' Tier Lists
-- (up to 50; findable, unblocked players only).
create or replace function public.top3_tiers(players uuid[], line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, t.line_id, t.tier
  from public.profiles pr
  cross join lateral public.top3_tiers_for(pr.id, auth.uid(), line_count) t
  where pr.id = any(players[1:50])
    and pr.allow_lookup
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
         or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
    )
$$;
revoke execute on function public.top3_tiers(uuid[], int) from public, anon;
grant execute on function public.top3_tiers(uuid[], int) to authenticated;

-- Find New: sort 'top3', and line_count for it. browse_players as in
-- profile_extras otherwise (same columns).
drop function if exists public.browse_players(text, boolean, int, int);
drop function if exists public.browse_players(text, boolean, int, int, int);

create function public.browse_players(
  sort text default 'fit',
  everyone boolean default false,
  page_size int default 20,
  page_offset int default 0,
  line_count int default 0
)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  match_pct int,
  fit_wants text[],
  fit_dont_wants text[],
  you_fit_pct int,
  you_fit_wants text[],
  you_fit_dont_wants text[],
  top_wants text[],
  list_voters int,
  voted boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  -- Your friends' demand (your Tier List), for "fits your list".
  g as (select * from public.group_demand((select id from me))),
  mine as (
    select p.line_id, p.choice
    from public.preferences p
    where p.user_id = (select id from me) and p.choice <> 'undecided'
  ),
  candidates as (
    select pr.*
    from public.profiles pr
    cross join cfg
    where pr.id <> (select id from me)
      and pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
      and not exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = pr.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
      and not exists (
        select 1 from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at and r.reporter_id = (select id from me)
      )
      and (
        select count(*) from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at
      ) < public.inactive_reports_to_hide()
  ),
  -- Friends with at least one want, per candidate (cheap: one row per friendship).
  friend_voters as materialized (
    select f.user_id as cand, count(*) as voters
    from public.friends f
    join candidates c on c.id = f.user_id
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_votes as materialized (
    select f.user_id as cand, f.friend_id, p.line_id
    from public.friends f
    join friend_voters v on v.cand = f.user_id and v.voters >= 3
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    join public.preferences p on p.user_id = f.friend_id and p.choice = 'want'
    where f.friend_id <> (select id from me)
  ),
  friend_wants as (
    select fv.cand, fv.line_id, count(*)::numeric as demand
    from friend_votes fv
    group by fv.cand, fv.line_id
  ),
  -- Their list needs 3+ friends who've voted (friend_votes only reads those);
  -- below that "for you" stays a dash. Their own wants don't stand in.
  demand as materialized (
    select fw.cand, fw.line_id, fw.demand / max(fw.demand) over (partition by fw.cand) as share
    from friend_wants fw
  ),
  demand_cands as materialized (select cand, sum(share) as cap from demand group by cand),
  you_agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), coalesce(max(dc.cap), 0))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share is not null), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share is not null), '{}') as fit_dont_wants
    from candidates c
    cross join mine m
    left join demand d on d.cand = c.id and d.line_id = m.line_id
    left join demand_cands dc on dc.cand = c.id
    group by c.id
  ),
  -- "Fits your list": their wants and don't-wants against your friends' demand.
  they_agg as (
    select
      p.user_id as cand,
      coalesce(sum(coalesce(g.share, 0)) filter (where p.choice = 'want'), 0) as hit,
      least(count(*) filter (where p.choice = 'want'), (select coalesce(sum(share), 0) from g))
        + public.dont_want_weight() * coalesce(sum(g.share) filter (where p.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'want' and g.share is not null), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share is not null), '{}') as fit_dont_wants
    from public.preferences p
    join candidates c on c.id = p.user_id
    left join g on g.line_id = p.line_id
    where p.choice <> 'undecided'
    group by p.user_id
  ),
  scored as (
    select
      c.*,
      case when t.total > 0 and exists (select 1 from g) then round(100.0 * t.hit / t.total)::int end as they_pct,
      coalesce(t.fit_wants, '{}') as they_wants,
      coalesce(t.fit_dont_wants, '{}') as they_dont_wants,
      case when y.total > 0 and dc.cand is not null then round(100.0 * y.hit / y.total)::int end as you_pct,
      coalesce(y.fit_wants, '{}') as you_wants,
      coalesce(y.fit_dont_wants, '{}') as you_dont_wants,
      coalesce((select v.voters from friend_voters v where v.cand = c.id and v.voters >= 3), 0)::int as list_voters,
      exists (select 1 from public.preferences p where p.user_id = c.id and p.choice <> 'undecided') as voted
    from candidates c
    left join they_agg t on t.cand = c.id
    left join you_agg y on y.cand = c.id
    left join demand_cands dc on dc.cand = c.id
  ),
  combined as (
    -- Best match: the two added up, a missing one counting as 0, so a dash on
    -- either side can't ride the other number to the top. Both missing: last.
    select s.*,
      case when s.they_pct is null and s.you_pct is null then null
           else coalesce(s.they_pct, 0) + coalesce(s.you_pct, 0) end as both_pct
    from scored s
  ),
  listed as (
    -- Good fits: neither number is a low fit, and their list wants at least min_shared_wants of yours.
    select s.*
    from combined s, cfg
    where everyone
       -- No friends' votes yet: "for them" is unknown, so only "for you" counts.
       or (coalesce(s.they_pct, s.you_pct) >= cfg.min_pct and s.you_pct >= cfg.min_pct
           and cardinality(s.you_wants) >= cfg.min_shared_wants)
  )
  select
    l.id,
    case when l.show_discord then l.discord_username end,
    case when l.show_discord then l.discord_display_name end,
    case when l.show_discord then l.avatar_url end,
    l.ign,
    l.friend_code,
    l.last_seen_at,
    l.prefs_updated_at,
    l.they_pct,
    case when public.shows_votes(l.id) then l.they_wants else '{}' end,
    case when public.shows_votes(l.id) then l.they_dont_wants else '{}' end,
    l.you_pct,
    l.you_wants,
    l.you_dont_wants,
    case when public.shows_votes(l.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = l.id and p.top), '{}') else '{}' end,
    l.list_voters,
    l.voted,
    count(*) over ()
  from listed l
  order by
    case when sort = 'active' then l.last_seen_at end desc nulls last,
    case when sort = 'you_fit' then l.you_pct end desc nulls last,
    case when sort = 'they_fit' then l.they_pct end desc nulls last,
    -- Your Top 3 by the tier each sits in on their Tier List (S 4 .. C 1, Avoid 0); no list: last.
    case when sort = 'top3' then (
      select sum(case t.tier when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end)
      from public.top3_tiers_for(l.id, (select id from me), line_count) t
    ) end desc nulls last,
    l.both_pct desc nulls last,
    cardinality(l.you_wants) desc,
    l.last_seen_at desc,
    l.id
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0)
$$;

revoke execute on function public.browse_players(text, boolean, int, int, int) from public, anon;
grant execute on function public.browse_players(text, boolean, int, int, int) to authenticated;
