-- Find New Friends fit, flipped: it now asks "if I add this player, does their
-- Tier List want what I want?" instead of "do their wants match my friends'?".
-- A player sends candy by their own Tier List (what their friends want), so a
-- good fit is someone whose friends want the candies you want.
--
--   their demand per line = how many of their friends want it / the most-wanted
--                           line's count (0..1). You're left out if they added
--                           you. Under 3 friends with votes, their own wants
--                           stand in (share 1 each), so one friend's votes are
--                           never exposed and tiny lists don't swing the score.
--   fit % = sum over YOUR wants of their demand
--           / (your wants + dont_want_weight() x sum over YOUR don't-wants of their demand)
--   fit_wants      = your wants their list wants (most wanted first)
--   fit_dont_wants = your don't-wants their list wants
--
-- Same signature and columns as before; only the scoring changes. My Friends
-- (get_friends) still scores against your own friends list. Safe to re-run.

create or replace function public.browse_players(
  sort text default 'fit',
  everyone boolean default false,
  page_size int default 20,
  page_offset int default 0
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
  top_wants text[],
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
  demand as materialized (
    select fw.cand, fw.line_id, fw.demand / max(fw.demand) over (partition by fw.cand) as share
    from friend_wants fw
    union all
    -- Fewer than 3 friends with votes: their own wants stand in.
    select p.user_id, p.line_id, 1::numeric
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice = 'want'
      and not exists (select 1 from friend_voters v where v.cand = p.user_id and v.voters >= 3)
  ),
  demand_cands as materialized (select distinct cand from demand),
  agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      count(*) filter (where m.choice = 'want')
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share is not null), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share is not null), '{}') as fit_dont_wants
    from candidates c
    cross join mine m
    left join demand d on d.cand = c.id and d.line_id = m.line_id
    group by c.id
  ),
  scored as (
    select
      c.*,
      case when a.total > 0 and dc.cand is not null
        then round(100.0 * a.hit / a.total)::int end as pct,
      coalesce(a.fit_wants, '{}') as wants_shared,
      coalesce(a.fit_dont_wants, '{}') as dont_wants_shared
    from candidates c
    left join agg a on a.cand = c.id
    left join demand_cands dc on dc.cand = c.id
  ),
  listed as (
    select s.*
    from scored s, cfg
    where everyone or (s.pct >= cfg.min_pct and cardinality(s.wants_shared) >= cfg.min_shared_wants)
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
    l.pct,
    l.wants_shared,
    l.dont_wants_shared,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = l.id and p.top), '{}'),
    count(*) over ()
  from listed l
  order by
    case when sort = 'active' then l.last_seen_at end desc nulls last,
    l.pct desc nulls last,
    cardinality(l.wants_shared) desc,
    l.last_seen_at desc,
    l.id
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0)
$$;

revoke execute on function public.browse_players(text, boolean, int, int) from public, anon;
grant execute on function public.browse_players(text, boolean, int, int) to authenticated;
