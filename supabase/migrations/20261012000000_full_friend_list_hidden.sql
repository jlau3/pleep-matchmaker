-- Players whose friend list is full (max_friends()) are left out of other
-- people's matches: they can't take anyone new. This is computed on read, not
-- written to open_to_friends, so they reappear as soon as they drop below the
-- cap and their own setting is untouched. Lookup is unaffected.
--
-- Same as the init version apart from the friend-count check in candidates.

create or replace function public.get_matches()
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
  shared_wants text[],
  shared_dont_wants text[]
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
    from public.profiles pr, cfg
    where pr.id <> (select id from me)
      and pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
  ),
  theirs as (
    select p.user_id, p.line_id, p.choice
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice <> 'undecided'
  ),
  pair_lines as (
    select c.id as other_id, m.line_id from candidates c cross join mine m
    union
    select t.user_id, t.line_id from theirs t
  ),
  scored as (
    select pl.other_id, pl.line_id, m.choice as a, t.choice as b
    from pair_lines pl
    left join mine m on m.line_id = pl.line_id
    left join theirs t on t.user_id = pl.other_id and t.line_id = pl.line_id
  ),
  agg as (
    select
      s.other_id,
      sum(case
            when s.a = 'want' and s.b = 'want' then cfg.w_both_want
            when s.a = 'dont_want' and s.b = 'dont_want' then cfg.w_both_dont
            when (s.a = 'want' and s.b = 'dont_want') or (s.a = 'dont_want' and s.b = 'want') then cfg.w_conflict
            else 0
          end) as score,
      sum(case when s.a = 'want' or s.b = 'want' then cfg.w_both_want else cfg.w_both_dont end) as best,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'want' and s.b = 'want'), '{}') as shared_wants,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'dont_want' and s.b = 'dont_want'), '{}') as shared_dont_wants
    from scored s, cfg
    group by s.other_id
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
    round(100.0 * greatest(a.score, 0) / a.best)::int as match_pct,
    a.shared_wants,
    a.shared_dont_wants
  from agg a
  join candidates c on c.id = a.other_id
  cross join cfg
  where cardinality(a.shared_wants) >= cfg.min_shared_wants
    and 100.0 * greatest(a.score, 0) / a.best >= cfg.min_pct
  order by match_pct desc, cardinality(a.shared_wants) desc, c.last_seen_at desc
  limit 100
$$;
