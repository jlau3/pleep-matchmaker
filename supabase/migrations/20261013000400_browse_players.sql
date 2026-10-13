-- Find New Friends, paged and sortable. browse_players returns one page of
-- the players you could befriend, plus the total for paging.
--
--   everyone = false: "Good fits", the same rule as get_matches (fit >=
--                     min_pct and >= min_shared_wants wants your friends share).
--   everyone = true:  everyone you could add, including low fits and players
--                     who haven't voted yet (fit null, listed after the rest).
--
-- Never listed (you couldn't befriend them anyway): yourself, blocked either
-- way, already on your list, list full, not open to new friends, no friend
-- code, inactive for stale_after, or reported inactive (see inactive_reports).
--
-- sort: 'fit' (default: best fit first), 'active' (most recently seen), or
-- 'shared' (most wants your friends share). Ties fall back to fit, shared
-- wants, recency and id, so pages never shuffle. Safe to re-run.

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
  g as (select * from public.group_demand((select id from me))),
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
  agg as (
    select
      p.user_id,
      coalesce(sum(coalesce(g.share, 0)) filter (where p.choice = 'want'), 0) as hit,
      count(*) filter (where p.choice = 'want')
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
      case when a.total > 0 and exists (select 1 from g) then round(100.0 * a.hit / a.total)::int end as pct,
      coalesce(a.fit_wants, '{}') as wants_shared,
      coalesce(a.fit_dont_wants, '{}') as dont_wants_shared
    from candidates c
    left join agg a on a.user_id = c.id
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
    count(*) over ()
  from listed l
  order by
    case when sort = 'active' then l.last_seen_at end desc nulls last,
    case when sort = 'shared' then cardinality(l.wants_shared) end desc nulls last,
    l.pct desc nulls last,
    cardinality(l.wants_shared) desc,
    l.last_seen_at desc,
    l.id
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0)
$$;

revoke execute on function public.browse_players(text, boolean, int, int) from public, anon;
grant execute on function public.browse_players(text, boolean, int, int) to authenticated;
