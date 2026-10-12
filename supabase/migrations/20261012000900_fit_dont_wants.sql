-- Fit counts don't-wants. Friends send each other candy, and getting candy
-- you don't want annoys people at least as much as missing a want. So a
-- player who doesn't want a candy your friends want a lot is a worse fit:
-- each such don't-want adds dont_want_weight() x that line's share to the
-- bottom of the fraction.
--
--   fit % = sum over their wants of (weight x share)
--           / (sum of their want weights + dont_want_weight() x sum over their don't-wants of share)
--
-- A don't-want on a line your friends don't want (share 0) costs nothing,
-- and the % stays within 0..100. Safe to re-run.

create or replace function public.dont_want_weight()
returns numeric
language sql
immutable
as $$ select 1.0 $$;

create or replace function public.fit_pct(viewer uuid, player uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  g as (select * from public.group_demand(viewer, player)),
  theirs as (
    select p.line_id, p.choice, case when p.top then public.top_multiplier() else 1 end as w
    from public.preferences p
    where p.user_id = player and p.choice <> 'undecided'
  ),
  agg as (
    select
      coalesce(sum(t.w * coalesce(g.share, 0)) filter (where t.choice = 'want'), 0) as hit,
      coalesce(sum(t.w) filter (where t.choice = 'want'), 0)
        + public.dont_want_weight() * coalesce(sum(g.share) filter (where t.choice = 'dont_want'), 0) as total
    from theirs t
    left join g on g.line_id = t.line_id
  )
  select case when exists (select 1 from g) and total > 0 then round(100.0 * hit / total)::int end from agg
$$;

revoke execute on function public.fit_pct(uuid, uuid) from public, anon, authenticated;


drop function if exists public.get_matches();

create function public.get_matches()
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
  fit_dont_wants text[]
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
  -- Prune: a match needs min_shared_wants wants your friends want too.
  sharers as (
    select p.user_id
    from public.preferences p
    join g on g.line_id = p.line_id
    cross join cfg
    where p.choice = 'want' and p.user_id <> (select id from me)
    group by p.user_id, cfg.min_shared_wants
    having count(*) >= cfg.min_shared_wants
  ),
  candidates as (
    select pr.*
    from public.profiles pr
    join sharers s on s.user_id = pr.id
    cross join cfg
    where pr.open_to_friends
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
      coalesce(sum((case when p.top then public.top_multiplier() else 1 end) * coalesce(g.share, 0))
        filter (where p.choice = 'want'), 0) as hit,
      coalesce(sum(case when p.top then public.top_multiplier() else 1 end) filter (where p.choice = 'want'), 0)
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
  )
  select
    c.id,
    c.discord_username,
    c.discord_display_name,
    c.avatar_url,
    c.ign,
    c.friend_code,
    c.last_seen_at,
    c.prefs_updated_at,
    round(100.0 * a.hit / a.total)::int as match_pct,
    a.fit_wants,
    a.fit_dont_wants
  from agg a
  join candidates c on c.id = a.user_id
  cross join cfg
  where a.total > 0 and 100.0 * a.hit / a.total >= cfg.min_pct
  order by match_pct desc, cardinality(a.fit_wants) desc, c.last_seen_at desc
  limit 100
$$;

revoke execute on function public.get_matches() from public, anon;
grant execute on function public.get_matches() to authenticated;
