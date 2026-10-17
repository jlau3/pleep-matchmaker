-- Match %s never wait on friends voting: a player's friends' demand is topped
-- up with demand_prior_votes() stand-in friends who vote like everyone (active
-- players' Want rates). No friends voting = the Everyone list; each real friend
-- who votes counts as much as one stand-in, so Everyone fades as votes come in
-- (5 stand-ins: half at 5 friends, under 10% at 50). "For them" is still a dash
-- until the player has voted themselves: their own wants are never invented.
-- Changes group_demand, their_list_demand, browse_players and browse_all (keeping
-- the icon requirement from 20261024000100_require_profile_icon.sql). Safe to re-run.

create or replace function public.demand_prior_votes()
returns numeric
language sql
immutable
as $$ select 5::numeric $$;

-- "They'd send you" lists keep candy at least this share of their top pick's demand.
create or replace function public.demand_list_min()
returns numeric
language sql
immutable
as $$ select 0.25::numeric $$;

-- Share of active players (with at least one Want) who want each candy.
create or replace function public.community_want_rate()
returns table (line_id text, rate numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  active as (
    select pr.id
    from public.profiles pr, cfg
    where pr.last_seen_at > now() - cfg.stale_after
      and exists (select 1 from public.preferences p where p.user_id = pr.id and p.choice = 'want')
  ),
  n as (select count(*)::numeric as n from active)
  select p.line_id, count(*)::numeric / (select n from n)
  from public.preferences p
  join active a on a.id = p.user_id
  where p.choice = 'want' and (select n from n) > 0
  group by p.line_id
$$;
revoke execute on function public.community_want_rate() from public, anon, authenticated;

-- Your friends' demand (your Tier List), blended with Everyone. skip leaves one player out.
create or replace function public.group_demand(viewer uuid, skip uuid default null)
returns table (line_id text, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with
  voters as (
    select f.friend_id
    from public.friends f
    join public.profiles pr on pr.id = f.friend_id
    where f.user_id = viewer and f.friend_id is distinct from skip
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
  ),
  friend_wants as (
    select p.line_id, count(*)::numeric as wants
    from voters v
    join public.preferences p on p.user_id = v.friend_id and p.choice = 'want'
    group by p.line_id
  ),
  blended as (
    select coalesce(fw.line_id, c.line_id) as line_id,
      (coalesce(fw.wants, 0) + public.demand_prior_votes() * coalesce(c.rate, 0))
        / nullif((select count(*) from voters) + public.demand_prior_votes(), 0) as d
    from friend_wants fw
    full join public.community_want_rate() c on c.line_id = fw.line_id
  )
  -- (Tests set demand_prior_votes() to 0 for friends-only math; then no friends = no list.)
  select b.line_id, b.d / max(b.d) over () from blended b where b.d > 0
$$;
revoke execute on function public.group_demand(uuid, uuid) from public, anon, authenticated;

-- A player's friends' demand (their Tier List), leaving the viewer out, blended with Everyone.
create or replace function public.their_list_demand(player uuid, viewer uuid)
returns table (line_id text, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.group_demand(player, viewer)
$$;
revoke execute on function public.their_list_demand(uuid, uuid) from public, anon, authenticated;

create or replace function public.browse_players(
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
  top3_tiers jsonb,
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
    where public.social_profile_ready(auth.uid()) and public.social_profile_ready(pr.id) and pr.id <> (select id from me)
      and pr.open_to_friends
      -- Strangers only see an IGN, so no IGN: not suggested.
      and pr.ign is not null
      -- Not findable by search: not suggested either.
      and pr.allow_lookup
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
    join public.profiles fp on fp.id = f.friend_id
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_wants as materialized (
    select f.user_id as cand, p.line_id, count(*)::numeric as wants
    from public.friends f
    join friend_voters v on v.cand = f.user_id
    join public.profiles fp on fp.id = f.friend_id
    join public.preferences p on p.user_id = f.friend_id and p.choice = 'want'
    where f.friend_id <> (select id from me)
    group by f.user_id, p.line_id
  ),
  community as materialized (select * from public.community_want_rate()),
  demand_lines as (select line_id from community union select line_id from friend_wants),
  -- Their friends' demand, topped up with demand_prior_votes() stand-in friends who
  -- vote like everyone: no friends voting is Everyone's list, and Everyone fades as
  -- real votes come in (20261026000300). So "for you" is never a dash for that.
  blended as (
    select c.id as cand, l.line_id,
      (coalesce(fw.wants, 0) + public.demand_prior_votes() * coalesce(cw.rate, 0))
        / nullif(coalesce(v.voters, 0) + public.demand_prior_votes(), 0) as d
    from candidates c
    cross join demand_lines l
    left join community cw on cw.line_id = l.line_id
    left join friend_voters v on v.cand = c.id
    left join friend_wants fw on fw.cand = c.id and fw.line_id = l.line_id
  ),
  demand as materialized (
    select b.cand, b.line_id, b.d / max(b.d) over (partition by b.cand) as share
    from blended b
    where b.d > 0
  ),
  demand_cands as materialized (select cand, sum(share) as cap from demand group by cand),
  you_agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), coalesce(max(dc.cap), 0))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share >= public.demand_list_min()), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share >= public.demand_list_min()), '{}') as fit_dont_wants
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
        filter (where p.choice = 'want' and g.share >= public.demand_list_min()), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share >= public.demand_list_min()), '{}') as fit_dont_wants
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
      coalesce((select v.voters from friend_voters v where v.cand = c.id), 0)::int as list_voters,
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
       -- "For them" is only unknown when they haven't voted: never a good match then.
       or (s.they_pct >= cfg.min_pct and s.you_pct >= cfg.min_pct
           and cardinality(s.you_wants) >= cfg.min_shared_wants)
  ),
  -- Your Top 3's tiers on each listed player's Tier List, all at once; only
  -- read when sorting by them (a one-time filter skips it otherwise).
  sort_top3 as (
    select t.user_id, sum(case t.tier when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end) as score
    from public.top3_tiers_set(array(select l.id from listed l), (select id from me), line_count) t
    where sort = 'top3'
    group by t.user_id
  ),
  ranked as (
    select l.*,
      row_number() over (
        order by
          case when sort = 'active' then l.last_seen_at end desc nulls last,
          case when sort = 'you_fit' then l.you_pct end desc nulls last,
          case when sort = 'they_fit' then l.they_pct end desc nulls last,
          -- Your Top 3 by the tier each sits in on their Tier List (S 4 .. C 1, Avoid 0); all dashes: last.
          case when sort = 'top3' then st.score end desc nulls last,
          l.both_pct desc nulls last,
          cardinality(l.you_wants) desc,
          l.last_seen_at desc,
          l.id
      ) as rn,
      count(*) over () as total
    from listed l
    left join sort_top3 st on st.user_id = l.id
  ),
  page as (
    select r.* from ranked r
    where r.rn > greatest(page_offset, 0)
      and r.rn <= greatest(page_offset, 0) + least(greatest(page_size, 1), 50)
  ),
  -- For the cards, whatever the sort: line -> tier, for this page only.
  page_top3 as (
    select t.user_id, jsonb_object_agg(t.line_id, t.tier) as tiers
    from public.top3_tiers_set(array(select p.id from page p), (select id from me), line_count) t
    group by t.user_id
  )
  select
    l.id,
    case when public.shows_discord(l.id, l.show_discord) then l.discord_username end,
    case when public.shows_discord(l.id, l.show_discord) then l.discord_display_name end,
    case when public.shows_discord(l.id, l.show_discord) then l.avatar_url end,
    l.ign,
    null::text,
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
    pt.tiers,
    l.total
  from page l
  left join page_top3 pt on pt.user_id = l.id
  order by l.rn
$$;

create or replace function public.browse_all()
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
  both_pct int,
  good boolean,
  game_avatar text,
  reddit_username text,
  votes_hidden boolean
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
    where public.social_profile_ready(auth.uid()) and public.social_profile_ready(pr.id) and pr.id <> (select id from me)
      and pr.open_to_friends
      -- Strangers only see an IGN, so no IGN: not suggested.
      and pr.ign is not null
      -- Not findable by search: not suggested either.
      and pr.allow_lookup
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
    join public.profiles fp on fp.id = f.friend_id
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_wants as materialized (
    select f.user_id as cand, p.line_id, count(*)::numeric as wants
    from public.friends f
    join friend_voters v on v.cand = f.user_id
    join public.profiles fp on fp.id = f.friend_id
    join public.preferences p on p.user_id = f.friend_id and p.choice = 'want'
    where f.friend_id <> (select id from me)
    group by f.user_id, p.line_id
  ),
  community as materialized (select * from public.community_want_rate()),
  demand_lines as (select line_id from community union select line_id from friend_wants),
  -- Their friends' demand, topped up with demand_prior_votes() stand-in friends who
  -- vote like everyone: no friends voting is Everyone's list, and Everyone fades as
  -- real votes come in (20261026000300). So "for you" is never a dash for that.
  blended as (
    select c.id as cand, l.line_id,
      (coalesce(fw.wants, 0) + public.demand_prior_votes() * coalesce(cw.rate, 0))
        / nullif(coalesce(v.voters, 0) + public.demand_prior_votes(), 0) as d
    from candidates c
    cross join demand_lines l
    left join community cw on cw.line_id = l.line_id
    left join friend_voters v on v.cand = c.id
    left join friend_wants fw on fw.cand = c.id and fw.line_id = l.line_id
  ),
  demand as materialized (
    select b.cand, b.line_id, b.d / max(b.d) over (partition by b.cand) as share
    from blended b
    where b.d > 0
  ),
  demand_cands as materialized (select cand, sum(share) as cap from demand group by cand),
  you_agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), coalesce(max(dc.cap), 0))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share >= public.demand_list_min()), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share >= public.demand_list_min()), '{}') as fit_dont_wants
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
        filter (where p.choice = 'want' and g.share >= public.demand_list_min()), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share >= public.demand_list_min()), '{}') as fit_dont_wants
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
      coalesce((select v.voters from friend_voters v where v.cand = c.id), 0)::int as list_voters,
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
  )
  select
    s.id,
    case when public.shows_discord(s.id, s.show_discord) then s.discord_username end,
    case when public.shows_discord(s.id, s.show_discord) then s.discord_display_name end,
    case when public.shows_discord(s.id, s.show_discord) then s.avatar_url end,
    s.ign,
    null::text,
    s.last_seen_at,
    s.prefs_updated_at,
    s.they_pct,
    case when public.shows_votes(s.id) then s.they_wants else '{}' end,
    case when public.shows_votes(s.id) then s.they_dont_wants else '{}' end,
    s.you_pct,
    s.you_wants,
    s.you_dont_wants,
    case when public.shows_votes(s.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = s.id and p.top), '{}') else '{}' end,
    s.list_voters,
    s.voted,
    s.both_pct::int,
    -- Good fits: neither number is a low fit, and their list wants at least min_shared_wants of yours.
    -- "For them" is only unknown when they haven't voted: never a good match then.
    coalesce(s.they_pct >= cfg.min_pct and s.you_pct >= cfg.min_pct
      and cardinality(s.you_wants) >= cfg.min_shared_wants, false),
    s.game_avatar,
    case when public.shows_discord(s.id, s.show_reddit) then s.reddit_username end,
    not public.shows_votes(s.id)
  from combined s, cfg
  -- Best match order, so a capped list keeps the best.
  order by s.both_pct desc nulls last, cardinality(s.you_wants) desc, s.last_seen_at desc, s.id
  limit 1000
$$;
