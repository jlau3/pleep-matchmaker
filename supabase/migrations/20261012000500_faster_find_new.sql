-- Faster Find New. Same results as before, less work:
--
-- 1. Prune first. A match needs min_shared_wants lines both players want, so
--    only players with that many wants in common with the caller are scored
--    (found through preferences_line_choice_idx on the caller's few wants).
-- 2. One pass over those players' votes. Instead of building every
--    (candidate x line) pair and joining both sides twice, each of their votes
--    is joined to the caller's matching vote (if any) and the best case is
--    assembled from totals:
--      best = my lines' best + their lines' best - overlap correction
--    where, on a line both voted, the correction swaps the two one-sided best
--    cases for the shared one. Lines only one side voted score 0 either way.
--
-- Scoring is unchanged (see the init migration and the Top 3 migration):
-- both want +3, both don't +1, clash -3, x top_multiplier() on a line either
-- player starred; pct = max(0, score) / best.

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
    select p.line_id, p.choice, p.top,
           (case when p.top then public.top_multiplier() else 1 end)
             * (case when p.choice = 'want' then cfg.w_both_want else cfg.w_both_dont end) as own_best
    from public.preferences p, cfg
    where p.user_id = (select id from me) and p.choice <> 'undecided'
  ),
  my_total as (select coalesce(sum(own_best), 0) as best from mine),
  sharers as (
    select p.user_id
    from public.preferences p
    join mine m on m.line_id = p.line_id and m.choice = 'want'
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
      -- Find New is for new people: skip anyone the caller already added.
      and not exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = pr.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
  ),
  rows as (
    select
      t.user_id,
      t.line_id,
      m.choice as a,
      t.choice as b,
      (case when t.top then public.top_multiplier() else 1 end)
        * (case when t.choice = 'want' then cfg.w_both_want else cfg.w_both_dont end) as their_best,
      m.own_best,
      case when coalesce(m.top, false) or t.top then public.top_multiplier() else 1 end as mult
    from public.preferences t
    join candidates c on c.id = t.user_id
    left join mine m on m.line_id = t.line_id
    cross join cfg
    where t.choice <> 'undecided'
  ),
  agg as (
    select
      r.user_id as other_id,
      sum(case when r.a is null then 0 else r.mult * case
            when r.a = 'want' and r.b = 'want' then cfg.w_both_want
            when r.a = 'dont_want' and r.b = 'dont_want' then cfg.w_both_dont
            when (r.a = 'want' and r.b = 'dont_want') or (r.a = 'dont_want' and r.b = 'want') then cfg.w_conflict
            else 0
          end end) as score,
      (select best from my_total)
        + sum(r.their_best)
        - sum(case when r.a is null then 0 else
                r.own_best + r.their_best
                - r.mult * case when r.a = 'want' or r.b = 'want' then cfg.w_both_want else cfg.w_both_dont end
              end) as best,
      coalesce(array_agg(r.line_id order by r.line_id) filter (where r.a = 'want' and r.b = 'want'), '{}') as shared_wants,
      coalesce(array_agg(r.line_id order by r.line_id) filter (where r.a = 'dont_want' and r.b = 'dont_want'), '{}') as shared_dont_wants
    from rows r, cfg
    group by r.user_id
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
    and a.best > 0
    and 100.0 * greatest(a.score, 0) / a.best >= cfg.min_pct
  order by match_pct desc, cardinality(a.shared_wants) desc, c.last_seen_at desc
  limit 100
$$;
