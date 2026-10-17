-- Expected candy fit production handoff: squash of 20261026000000–20261026000500.
-- Requires the schema through 20261025000100. Run once, after dev approval.
-- Do not also apply the six individual files. Dev keeps its existing history.
begin;
do $guard$ begin
  if to_regprocedure('public.trial_pair_scores(uuid,uuid[])') is not null then
    raise exception 'Expected candy fit trial is already installed; do not replay this bundle';
  end if;
end $guard$;

-- Source: 20261026000000_half_dont_want.sql
-- Tier List scoring: a Don't Want counts half (Want +1, Neutral 0, Don't Want
-- -1/2), matching src/lib/tiers.ts. You send one candy a day to every friend,
-- so a candy is worth Want 1, Neutral 1/3, Don't Want 0 to each of them; shifted
-- so Neutral is 0 that's +1 / 0 / -1/2. list_tiers and top3_tiers_set (your Top 3 on
-- other players' Tier Lists) keep copies of the rules. Safe to re-run.

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
    join public.profiles fp on fp.id = f.friend_id
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
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row.
  scored as (
    select vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo, nv
    union all
    select '', 0::numeric, greatest(line_count - (select count(*) from votes)::int, 0)
    from nv
    where line_count > (select count(*) from votes)
  ),
  runs as (select s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.score),
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
  select s.line_id, case when s.score < 0 then 'Avoid' when s.score = 0 then 'C' else t.tier end
  from scored s
  left join tiered t on t.score = s.score
  where (select n from nv) > 0
$$;

create or replace function public.top3_tiers_set(players uuid[], viewer uuid, line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  tops as (select p.line_id from public.preferences p where p.user_id = viewer and p.top),
  cands as (
    select distinct c.id from unnest(players[1:1000]) as c(id)
    where exists (select 1 from tops)
  ),
  -- Everyone on each list (as list_tiers: their findable friends, you
  -- included), one row per friendship: cheap next to one per vote.
  fr as materialized (
    select f.user_id as cand, f.friend_id,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice <> 'undecided') as voted,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want') as wants
    from cands c
    join public.friends f on f.user_id = c.id
    join public.profiles fp on fp.id = f.friend_id
  ),
  -- Lists that count: 3+ of their friends besides you want something ("for you").
  nv as materialized (
    select fr.cand, (count(*) filter (where fr.voted))::int as n
    from fr
    group by fr.cand
    having count(*) filter (where fr.wants and fr.friend_id <> viewer) >= 3
  ),
  votes as materialized (
    select fr.cand, p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d,
      bool_or(p.choice = 'want' and fr.friend_id <> viewer) as wanted
    from fr
    join nv on nv.cand = fr.cand
    join public.preferences p on p.user_id = fr.friend_id and p.choice <> 'undecided'
    group by fr.cand, p.line_id
  ),
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row ('' = unvoted lines).
  scored as (
    select vo.cand, vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo join nv on nv.cand = vo.cand
    union all
    select nv.cand, '', 0, line_count - count(vo.line_id)::int
    from nv
    left join votes vo on vo.cand = nv.cand
    group by nv.cand, nv.n
    having line_count > count(vo.line_id)
  ),
  runs as (select s.cand, s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.cand, s.score),
  pos as (
    select r.cand, r.score, r.size,
      coalesce(sum(r.size) over (partition by r.cand order by r.score desc rows between unbounded preceding and 1 preceding), 0)::int as start,
      sum(r.size) over (partition by r.cand)::int as n
    from runs r
  ),
  -- A run of tied lines takes the tier of its middle position; the best run is always S.
  tiered as (
    select p.cand, p.score,
      case
        when p.start = 0 then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8) * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8 + 0.3::float8) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  -- Every list that counts gets all your starred lines: the tier where their
  -- friends want it, else Avoid (none of them want it, or more don't than do):
  -- you're unlikely to get it from this player. No list yet: no rows.
  select nv.cand, tp.line_id, case when vo.wanted and s.score = 0 then 'C' when vo.wanted and s.score > 0 then t.tier else 'Avoid' end
  from nv
  cross join tops tp
  left join votes vo on vo.cand = nv.cand and vo.line_id = tp.line_id
  left join scored s on s.cand = nv.cand and s.line_id = tp.line_id
  left join tiered t on t.cand = nv.cand and t.score = s.score
$$;


-- Source: 20261026000100_quarter_tiers.sql
-- Standard Tier List: positive scores split into four equal groups (S, A, B, C
-- a quarter each; TIER_SHARES in src/lib/tiers.ts). Same scoring as
-- 20261026000000_half_dont_want.sql. Safe to re-run.

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
    join public.profiles fp on fp.id = f.friend_id
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
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row.
  scored as (
    select vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo, nv
    union all
    select '', 0::numeric, greatest(line_count - (select count(*) from votes)::int, 0)
    from nv
    where line_count > (select count(*) from votes)
  ),
  runs as (select s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.score),
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
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8) * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8 + 0.25::float8) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8 + 0.25::float8 + 0.25::float8) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  select s.line_id, case when s.score < 0 then 'Avoid' when s.score = 0 then 'C' else t.tier end
  from scored s
  left join tiered t on t.score = s.score
  where (select n from nv) > 0
$$;

create or replace function public.top3_tiers_set(players uuid[], viewer uuid, line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  tops as (select p.line_id from public.preferences p where p.user_id = viewer and p.top),
  cands as (
    select distinct c.id from unnest(players[1:1000]) as c(id)
    where exists (select 1 from tops)
  ),
  -- Everyone on each list (as list_tiers: their findable friends, you
  -- included), one row per friendship: cheap next to one per vote.
  fr as materialized (
    select f.user_id as cand, f.friend_id,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice <> 'undecided') as voted,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want') as wants
    from cands c
    join public.friends f on f.user_id = c.id
    join public.profiles fp on fp.id = f.friend_id
  ),
  -- Lists that count: 3+ of their friends besides you want something ("for you").
  nv as materialized (
    select fr.cand, (count(*) filter (where fr.voted))::int as n
    from fr
    group by fr.cand
    having count(*) filter (where fr.wants and fr.friend_id <> viewer) >= 3
  ),
  votes as materialized (
    select fr.cand, p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d,
      bool_or(p.choice = 'want' and fr.friend_id <> viewer) as wanted
    from fr
    join nv on nv.cand = fr.cand
    join public.preferences p on p.user_id = fr.friend_id and p.choice <> 'undecided'
    group by fr.cand, p.line_id
  ),
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row ('' = unvoted lines).
  scored as (
    select vo.cand, vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo join nv on nv.cand = vo.cand
    union all
    select nv.cand, '', 0, line_count - count(vo.line_id)::int
    from nv
    left join votes vo on vo.cand = nv.cand
    group by nv.cand, nv.n
    having line_count > count(vo.line_id)
  ),
  runs as (select s.cand, s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.cand, s.score),
  pos as (
    select r.cand, r.score, r.size,
      coalesce(sum(r.size) over (partition by r.cand order by r.score desc rows between unbounded preceding and 1 preceding), 0)::int as start,
      sum(r.size) over (partition by r.cand)::int as n
    from runs r
  ),
  -- A run of tied lines takes the tier of its middle position; the best run is always S.
  tiered as (
    select p.cand, p.score,
      case
        when p.start = 0 then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8) * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8 + 0.25::float8) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.25::float8 + 0.25::float8 + 0.25::float8) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  -- Every list that counts gets all your starred lines: the tier where their
  -- friends want it, else Avoid (none of them want it, or more don't than do):
  -- you're unlikely to get it from this player. No list yet: no rows.
  select nv.cand, tp.line_id, case when vo.wanted and s.score = 0 then 'C' when vo.wanted and s.score > 0 then t.tier else 'Avoid' end
  from nv
  cross join tops tp
  left join votes vo on vo.cand = nv.cand and vo.line_id = tp.line_id
  left join scored s on s.cand = nv.cand and s.line_id = tp.line_id
  left join tiered t on t.cand = nv.cand and t.score = s.score
$$;


-- Source: 20261026000200_pyramid_tiers.sql
-- Percentile Tier List: positive scores split 10 / 20 / 30 / 40% into S, A, B,
-- C (TIER_SHARES in src/lib/tiers.ts), so S is a short list to send first.
-- Replaces the quarters from 20261026000100. Shares are exact decimals, not
-- float8 (0.1 + 0.2 + 0.3 must be 0.6). Safe to re-run.

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
    join public.profiles fp on fp.id = f.friend_id
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
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row.
  scored as (
    select vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo, nv
    union all
    select '', 0::numeric, greatest(line_count - (select count(*) from votes)::int, 0)
    from nv
    where line_count > (select count(*) from votes)
  ),
  runs as (select s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.score),
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
        when (p.start + p.start + p.size - 1) / 2 < ceil(0.1 * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.1 + 0.2) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.1 + 0.2 + 0.3) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  select s.line_id, case when s.score < 0 then 'Avoid' when s.score = 0 then 'C' else t.tier end
  from scored s
  left join tiered t on t.score = s.score
  where (select n from nv) > 0
$$;

create or replace function public.top3_tiers_set(players uuid[], viewer uuid, line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  tops as (select p.line_id from public.preferences p where p.user_id = viewer and p.top),
  cands as (
    select distinct c.id from unnest(players[1:1000]) as c(id)
    where exists (select 1 from tops)
  ),
  -- Everyone on each list (as list_tiers: their findable friends, you
  -- included), one row per friendship: cheap next to one per vote.
  fr as materialized (
    select f.user_id as cand, f.friend_id,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice <> 'undecided') as voted,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want') as wants
    from cands c
    join public.friends f on f.user_id = c.id
    join public.profiles fp on fp.id = f.friend_id
  ),
  -- Lists that count: 3+ of their friends besides you want something ("for you").
  nv as materialized (
    select fr.cand, (count(*) filter (where fr.voted))::int as n
    from fr
    group by fr.cand
    having count(*) filter (where fr.wants and fr.friend_id <> viewer) >= 3
  ),
  votes as materialized (
    select fr.cand, p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d,
      bool_or(p.choice = 'want' and fr.friend_id <> viewer) as wanted
    from fr
    join nv on nv.cand = fr.cand
    join public.preferences p on p.user_id = fr.friend_id and p.choice <> 'undecided'
    group by fr.cand, p.line_id
  ),
  -- Support: Want +1, Neutral 0, Don't Want -1/2 (src/lib/tiers.ts POINTS). cnt: how many lines share the row ('' = unvoted lines).
  scored as (
    select vo.cand, vo.line_id, vo.w - 0.5 * vo.d as score, 1 as cnt
    from votes vo join nv on nv.cand = vo.cand
    union all
    select nv.cand, '', 0, line_count - count(vo.line_id)::int
    from nv
    left join votes vo on vo.cand = nv.cand
    group by nv.cand, nv.n
    having line_count > count(vo.line_id)
  ),
  runs as (select s.cand, s.score, sum(s.cnt)::int as size from scored s where s.score > 0 group by s.cand, s.score),
  pos as (
    select r.cand, r.score, r.size,
      coalesce(sum(r.size) over (partition by r.cand order by r.score desc rows between unbounded preceding and 1 preceding), 0)::int as start,
      sum(r.size) over (partition by r.cand)::int as n
    from runs r
  ),
  -- A run of tied lines takes the tier of its middle position; the best run is always S.
  tiered as (
    select p.cand, p.score,
      case
        when p.start = 0 then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil(0.1 * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.1 + 0.2) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.1 + 0.2 + 0.3) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  -- Every list that counts gets all your starred lines: the tier where their
  -- friends want it, else Avoid (none of them want it, or more don't than do):
  -- you're unlikely to get it from this player. No list yet: no rows.
  select nv.cand, tp.line_id, case when vo.wanted and s.score = 0 then 'C' when vo.wanted and s.score > 0 then t.tier else 'Avoid' end
  from nv
  cross join tops tp
  left join votes vo on vo.cand = nv.cand and vo.line_id = tp.line_id
  left join scored s on s.cand = nv.cand and s.line_id = tp.line_id
  left join tiered t on t.cand = nv.cand and t.score = s.score
$$;


-- Source: 20261026000300_blend_demand.sql
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


-- Source: 20261026000400_match_context_and_shared_rates.sql
-- Reuse a single, current Everyone aggregate for every score in My Friends.
-- No persistent cache, refresh job, or change to matching weights.
create or replace function public.group_demand_from_rates(viewer uuid, skip uuid, rates jsonb)
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
    full join (select key as line_id, value::numeric as rate from jsonb_each_text(rates)) c on c.line_id = fw.line_id
  )
  -- (Tests set demand_prior_votes() to 0 for friends-only math; then no friends = no list.)
  select b.line_id, b.d / max(b.d) over () from blended b where b.d > 0
$$;
create or replace function public.fit_pct_from_rates(viewer uuid, player uuid, rates jsonb)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  g as (select * from public.group_demand_from_rates(viewer, player, rates)),
  theirs as (
    select p.line_id, p.choice
    from public.preferences p
    where p.user_id = player and p.choice <> 'undecided'
  ),
  agg as (
    select
      coalesce(sum(coalesce(g.share, 0)) filter (where t.choice = 'want'), 0) as hit,
      least(count(*) filter (where t.choice = 'want'), (select coalesce(sum(share), 0) from g))
        + public.dont_want_weight() * coalesce(sum(g.share) filter (where t.choice = 'dont_want'), 0) as total
    from theirs t
    left join g on g.line_id = t.line_id
  )
  select case when exists (select 1 from g) and total > 0 then round(100.0 * hit / total)::int end from agg
$$;

create or replace function public.you_fit_pct_from_rates(viewer uuid, player uuid, rates jsonb)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  d as (select * from public.group_demand_from_rates(player, viewer, rates)),
  mine as (
    select p.line_id, p.choice from public.preferences p
    where p.user_id = viewer and p.choice <> 'undecided'
  ),
  agg as (
    select
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), (select coalesce(sum(share), 0) from d))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total
    from mine m
    left join d on d.line_id = m.line_id
  )
  select case when exists (select 1 from d) and total > 0 then round(100.0 * hit / total)::int end from agg
$$;

revoke all on function public.group_demand_from_rates(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fit_pct_from_rates(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.you_fit_pct_from_rates(uuid, uuid, jsonb) from public, anon, authenticated;

-- Keep get_friends' return shape and all existing privacy/contact rules.
-- Assert the expected query shape so a future change cannot silently skip batching.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.get_friends(boolean)'::regprocedure);
  if position('fit_pct_from_rates' in definition) = 0 then
    if position('public.fit_pct(auth.uid(), pr.id)' in definition) = 0
      or position('public.you_fit_pct(auth.uid(), pr.id)' in definition) = 0
      or position('from public.friends f' in definition) = 0 then
      raise exception 'get_friends query shape changed';
    end if;
    definition := regexp_replace(definition, '  select', '  with community as materialized (select coalesce(jsonb_object_agg(line_id, rate), ''{}''::jsonb) as rates from public.community_want_rate() where with_match) select');
    definition := replace(definition, 'public.fit_pct(auth.uid(), pr.id)', 'public.fit_pct_from_rates(auth.uid(), pr.id, community.rates)');
    definition := replace(definition, 'public.you_fit_pct(auth.uid(), pr.id)', 'public.you_fit_pct_from_rates(auth.uid(), pr.id, community.rates)');
    definition := replace(definition, 'from public.friends f', 'from public.friends f cross join community');
    execute definition;
  end if;
end
$migration$;

-- Extend the existing batched extras response with directional match context.
-- Existing icon, Reddit, private-vote and block rules are preserved.
drop function public.player_extras(uuid[]);
create or replace function public.player_extras(ids uuid[])
returns table (user_id uuid, game_avatar text, reddit_username text, votes_hidden boolean, you_source text, they_source text, you_voted boolean, they_voted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with wanted as materialized (select distinct p.user_id from public.preferences p where p.choice = 'want'),
  voting as materialized (select distinct p.user_id from public.preferences p where p.choice <> 'undecided'),
  friend_voters as materialized (
    select f.user_id, f.friend_id from public.friends f join wanted w on w.user_id = f.friend_id
  )
  select pr.id, pr.game_avatar,
    case when public.shows_discord(pr.id, pr.show_reddit)
           or (pr.show_reddit and exists (
                 select 1 from public.friend_requests r
                 where r.from_id = pr.id and r.to_id = auth.uid()
                   and r.status = 'open' and r.created_at > now() - public.request_ttl()))
         then pr.reddit_username end,
    not public.shows_votes(pr.id),
    case when public.demand_prior_votes() <= 0 then 'Friends'
      when exists (select 1 from friend_voters f where f.user_id = pr.id and f.friend_id <> auth.uid())
      then 'Friends + Everyone' else 'Everyone estimate' end,
    case when public.demand_prior_votes() <= 0 then 'Friends'
      when exists (select 1 from friend_voters f where f.user_id = auth.uid() and f.friend_id <> pr.id)
      then 'Friends + Everyone' else 'Everyone estimate' end,
    exists (select 1 from voting v where v.user_id = auth.uid()),
    case when public.shows_votes(pr.id) then exists (select 1 from voting v where v.user_id = pr.id) end
  from public.profiles pr
  where pr.id = any(ids[1:200])
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
         or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
    )
$$;

revoke all on function public.player_extras(uuid[]) from public, anon;
grant execute on function public.player_extras(uuid[]) to authenticated;


-- Source: 20261026000500_expected_candy_fit.sql
-- Expected candy fit trial. Demand is count-based Wants + k=5 global prior,
-- normalized to a sending distribution. Spotlight does not affect demand.
-- Private helpers are never callable by API roles. Client-side Recommended
-- filtering requires one eligibility bit PER ROW in All players. This accepted
-- disclosure reveals whether both utilities > 0, but never returns the hidden
-- other direction, its shares, its utility, lift, or ranking tie-breakers.

-- Preserve the existing global population, but retain integer counts so a
-- mathematically zero utility cannot turn positive through early rate division.
create or replace function public.trial_global_counts()
returns table(line_id text,wants numeric,voters numeric)
language sql stable security definer set search_path='' as $$
with active as materialized(
 select pr.id from public.profiles pr cross join public.match_config() cfg
 where pr.last_seen_at>now()-cfg.stale_after
 and exists(select 1 from public.preferences p where p.user_id=pr.id and p.choice='want')
)
select p.line_id,count(*)::numeric,(select count(*)::numeric from active)
from public.preferences p join active a on a.id=p.user_id where p.choice='want' group by p.line_id
$$;
revoke all on function public.trial_global_counts() from public,anon,authenticated;

create or replace function public.trial_pair_scores(viewer uuid, players uuid[])
returns table(candidate uuid, direction text, want_pct numeric, unwanted_pct numeric,
  utility numeric, baseline_utility numeric, lift numeric, friend_voters int, friend_bin text)
language sql stable security definer set search_path = '' as $$
with
ids as materialized (select distinct p.id from public.profiles p where p.id = any(players) and p.id <> viewer),
community as materialized (select * from public.trial_global_counts()),
pairs as (
  select i.id candidate, 'you'::text direction, viewer receiver, i.id sender,
    case when exists(select 1 from public.friends f where f.user_id=i.id and f.friend_id=viewer) then viewer end skip
  from ids i
  union all
  select i.id, 'them', i.id, viewer,
    case when exists(select 1 from public.friends f where f.user_id=viewer and f.friend_id=i.id) then i.id end
  from ids i
),
keyed as materialized (select p.*, p.sender::text || ':' || coalesce(p.skip::text,'') mix_key from pairs p),
targets as (select distinct mix_key,sender,skip from keyed),
wanted as materialized (select p.user_id,p.line_id from public.preferences p where p.choice='want'),
voting as materialized (select distinct user_id from public.preferences),
friend_voters as materialized (
 select t.mix_key,f.friend_id from targets t join public.friends f on f.user_id=t.sender
 where f.friend_id is distinct from t.skip and exists(select 1 from wanted w where w.user_id=f.friend_id)
),
counts as (select mix_key,count(*)::int n from friend_voters group by mix_key),
friend_wants as materialized (
 select f.mix_key,w.line_id,count(*)::numeric wants from friend_voters f join wanted w on w.user_id=f.friend_id
 group by f.mix_key,w.line_id
),
lines as (select line_id from community union select line_id from friend_wants),
strengths as (
 select t.mix_key,l.line_id,coalesce(w.wants,0)*coalesce((select max(voters) from community),1)+public.demand_prior_votes()*coalesce(c.wants,0) strength
 from targets t cross join lines l
 left join friend_wants w on w.mix_key=t.mix_key and w.line_id=l.line_id
 left join community c on c.line_id=l.line_id
),
mix as materialized (
 select s.mix_key,s.line_id,s.strength,sum(s.strength) over(partition by s.mix_key) total_strength,
  100*s.strength/sum(s.strength) over(partition by s.mix_key) share
 from strengths s where s.strength>0
),
measured as (
 select k.candidate,k.direction,k.receiver,coalesce(v.n,0)::int n,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then coalesce(sum(m.share) filter(where p.choice='want'),0) end w,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then coalesce(sum(m.share) filter(where p.choice='dont_want'),0) end d,
   case when exists(select 1 from voting x where x.user_id=k.receiver) and count(m.line_id)>0
     then 100*sum(m.strength*case p.choice when 'want' then 1 when 'dont_want' then -0.5 else 0 end)/max(m.total_strength) end net
 from keyed k left join mix m on m.mix_key=k.mix_key
 left join public.preferences p on p.user_id=k.receiver and p.line_id=m.line_id
 left join counts v on v.mix_key=k.mix_key
 group by k.candidate,k.direction,k.receiver,v.n
),
baselines as (
 select receivers.receiver,
 case when exists(select 1 from voting v where v.user_id=receivers.receiver) and sum(c.wants)>0 then
  100*coalesce(sum(c.wants*case p.choice when 'want' then 1 when 'dont_want' then -0.5 else 0 end),0)/sum(c.wants) end utility
 from (select distinct receiver from keyed) receivers cross join community c
 left join public.preferences p on p.user_id=receivers.receiver and p.line_id=c.line_id
 group by receivers.receiver
)
select m.candidate,m.direction,m.w,m.d,m.net,b.utility,m.net-b.utility,m.n,
 case when m.n=0 then '0' when m.n<5 then '1–4' else '5+' end
from measured m left join baselines b on b.receiver=m.receiver
$$;
revoke all on function public.trial_pair_scores(uuid,uuid[]) from public,anon,authenticated;

-- Preserve all existing eligibility rules. This private helper is reused by
-- suggestions and admin-only diagnostics; no caller can supply another viewer.
create or replace function public.trial_candidates(viewer uuid)
returns setof public.profiles language sql stable security definer set search_path = '' as $$
 select pr.* from public.profiles pr cross join public.match_config() cfg
 where public.social_profile_ready(viewer) and public.social_profile_ready(pr.id) and pr.id<>viewer
 and pr.open_to_friends and pr.ign is not null and pr.allow_lookup and pr.friend_code is not null
 and pr.last_seen_at>now()-cfg.stale_after
 and (select count(*) from public.friends f where f.user_id=pr.id)<public.max_friends()
 and not exists(select 1 from public.friends f where f.user_id=viewer and f.friend_id=pr.id)
 and not exists(select 1 from public.blocks b where (b.blocker_id=viewer and b.blocked_id=pr.id) or (b.blocker_id=pr.id and b.blocked_id=viewer))
 and not exists(select 1 from public.inactive_reports x where x.player_id=pr.id and x.created_at>pr.last_seen_at and x.reporter_id=viewer)
 and (select count(*) from public.inactive_reports x where x.player_id=pr.id and x.created_at>pr.last_seen_at)<public.inactive_reports_to_hide()
$$;
revoke all on function public.trial_candidates(uuid) from public,anon,authenticated;

drop function public.browse_players(text,boolean,integer,integer,integer);
drop function public.browse_all();
create function public.browse_all()
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,
 last_seen_at timestamptz,prefs_updated_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric,you_voted boolean,
 list_voters int,good boolean,game_avatar text,reddit_username text,votes_hidden boolean)
language sql stable security definer set search_path = '' as $$
with candidates as materialized(select * from public.trial_candidates(auth.uid())),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select id from candidates)))
select c.id,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_username end,
 case when public.shows_discord(c.id,c.show_discord) then c.discord_display_name end,
 case when public.shows_discord(c.id,c.show_discord) then c.avatar_url end,
 c.ign,null::text,c.last_seen_at,c.prefs_updated_at,u.want_pct,u.unwanted_pct,u.utility,(select exists(select 1 from public.preferences p where p.user_id=auth.uid())),u.friend_voters,
 coalesce(u.utility>0 and t.utility>0,false),c.game_avatar,
 case when public.shows_discord(c.id,c.show_reddit) then c.reddit_username end,not public.shows_votes(c.id)
from candidates c left join scores u on u.candidate=c.id and u.direction='you'
left join scores t on t.candidate=c.id and t.direction='them'
-- No hidden-direction tie breaker: the eligibility bit is the only accepted disclosure.
order by u.utility desc nulls last,c.last_seen_at desc,c.id limit 1000
$$;
revoke all on function public.browse_all() from public,anon;
grant execute on function public.browse_all() to authenticated;

create function public.browse_players(sort text default 'you_fit',everyone boolean default false,
 page_size int default 20,page_offset int default 0,line_count int default 0)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,
 last_seen_at timestamptz,prefs_updated_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric,you_voted boolean,
 list_voters int,good boolean,game_avatar text,reddit_username text,votes_hidden boolean,total_count bigint)
language sql stable security definer set search_path = '' as $$
with all_rows as materialized(select * from public.browse_all()),
listed as materialized(select * from all_rows where everyone or good),
spotlight as (
 select t.user_id,sum(case t.tier when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end) score
 from public.top3_tiers_set(array(select l.user_id from listed l),auth.uid(),line_count) t where sort='top3' group by t.user_id
)
select l.*,count(*) over() from listed l left join spotlight t on t.user_id=l.user_id
order by case when sort='active' then l.last_seen_at end desc nulls last,
 case when sort='top3' then t.score end desc nulls last,l.you_utility desc nulls last,l.last_seen_at desc,l.user_id
limit least(greatest(page_size,1),50) offset greatest(page_offset,0)
$$;
revoke all on function public.browse_players(text,boolean,integer,integer,integer) from public,anon;
grant execute on function public.browse_players(text,boolean,integer,integer,integer) to authenticated;

-- Keep identity/contact and privacy decisions from the established functions,
-- but move their old implementations behind private contact-only helpers.
do $migration$
declare definition text;
begin
 if to_regprocedure('public.trial_friend_contacts(boolean)') is null then
  alter function public.get_friends(boolean) rename to trial_friend_contacts;
 end if;
 if to_regprocedure('public.trial_request_contacts(boolean)') is null then
  alter function public.get_friend_requests(boolean) rename to trial_request_contacts;
 end if;
 if to_regprocedure('public.trial_lookup_contacts(text)') is null then
  alter function public.lookup_players(text) rename to trial_lookup_contacts;
  definition:=pg_get_functiondef('public.trial_lookup_contacts(text)'::regprocedure);
  if position('public.fit_pct(auth.uid(), h.id)' in definition)=0 or position('public.you_fit_pct(auth.uid(), h.id)' in definition)=0 then
   raise exception 'lookup query shape changed';
  end if;
  definition:=replace(definition,'public.fit_pct(auth.uid(), h.id)','null::int');
  definition:=replace(definition,'public.you_fit_pct(auth.uid(), h.id)','null::int');
  execute definition;
 end if;
end $migration$;
revoke all on function public.trial_friend_contacts(boolean) from public,anon,authenticated;
revoke all on function public.trial_request_contacts(boolean) from public,anon,authenticated;
revoke all on function public.trial_lookup_contacts(text) from public,anon,authenticated;

create or replace function public.get_friends(with_match boolean default true)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,added_at timestamptz,visible boolean,wants text[],dont_wants text[],top_wants text[],
 match_pct numeric,you_fit_pct numeric,added_me boolean,they_unwanted_pct numeric,you_unwanted_pct numeric,they_utility numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_friend_contacts(false)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts where with_match)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.added_at,c.visible,c.wants,c.dont_wants,c.top_wants,
 t.want_pct,u.want_pct,c.added_me,t.unwanted_pct,u.unwanted_pct,t.utility,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you'
left join scores t on t.candidate=c.user_id and t.direction='them'
order by c.added_at
$$;
revoke all on function public.get_friends(boolean) from public,anon;
grant execute on function public.get_friends(boolean) to authenticated;

create or replace function public.get_friend_requests(with_fit boolean default false)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,requested_at timestamptz,you_fit_pct numeric,you_unwanted_pct numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_request_contacts(false)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts where with_fit)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.requested_at,u.want_pct,u.unwanted_pct,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you' order by c.requested_at desc
$$;
revoke all on function public.get_friend_requests(boolean) from public,anon;
grant execute on function public.get_friend_requests(boolean) to authenticated;

create or replace function public.lookup_players(q text)
returns table(user_id uuid,discord_username text,discord_display_name text,avatar_url text,ign text,friend_code text,last_seen_at timestamptz,prefs_updated_at timestamptz,wants text[],dont_wants text[],top_wants text[],match_pct numeric,you_fit_pct numeric,
 they_unwanted_pct numeric,you_unwanted_pct numeric,they_utility numeric,you_utility numeric)
language sql stable security definer set search_path = '' as $$
with contacts as materialized(select * from public.trial_lookup_contacts(q)),
scores as materialized(select * from public.trial_pair_scores(auth.uid(),array(select user_id from contacts)))
select c.user_id,c.discord_username,c.discord_display_name,c.avatar_url,c.ign,c.friend_code,c.last_seen_at,c.prefs_updated_at,c.wants,c.dont_wants,c.top_wants,
 case when public.shows_votes(c.user_id) then t.want_pct end,u.want_pct,
 case when public.shows_votes(c.user_id) then t.unwanted_pct end,u.unwanted_pct,
 case when public.shows_votes(c.user_id) then t.utility end,u.utility
from contacts c left join scores u on u.candidate=c.user_id and u.direction='you'
left join scores t on t.candidate=c.user_id and t.direction='them'
$$;
revoke all on function public.lookup_players(text) from public,anon;
grant execute on function public.lookup_players(text) to authenticated;

create or replace function public.group_demand_from_rates(viewer uuid,skip uuid,rates jsonb)
returns table(line_id text,share numeric) language sql stable security definer set search_path='' as $$
with friend_wants as (
 select p.line_id,count(*)::numeric wants from public.friends f join public.preferences p on p.user_id=f.friend_id and p.choice='want'
 where f.user_id=viewer and f.friend_id is distinct from skip group by p.line_id
), c as(select key line_id,value::numeric rate from jsonb_each_text(rates)),
blend as(select coalesce(f.line_id,c.line_id) line_id,coalesce(f.wants,0)+public.demand_prior_votes()*coalesce(c.rate,0) d
from friend_wants f full join c on c.line_id=f.line_id)
select line_id,d/sum(d) over() from blend where d>0
$$;
create or replace function public.group_demand(viewer uuid,skip uuid default null)
returns table(line_id text,share numeric) language sql stable security definer set search_path='' as $$
 select * from public.group_demand_from_rates(viewer,skip,(select coalesce(jsonb_object_agg(line_id,rate),'{}'::jsonb) from public.community_want_rate()))
$$;
create or replace function public.fit_pct_from_rates(viewer uuid,player uuid,rates jsonb)
returns int language sql stable security definer set search_path='' as $$
with d as materialized(select * from public.group_demand_from_rates(viewer,player,rates))
select case when exists(select 1 from public.preferences where user_id=player) and exists(select 1 from d)
 then round(100*coalesce(sum(d.share) filter(where p.choice='want'),0))::int end
from d left join public.preferences p on p.user_id=player and p.line_id=d.line_id
$$;
create or replace function public.you_fit_pct_from_rates(viewer uuid,player uuid,rates jsonb)
returns int language sql stable security definer set search_path='' as $$
with d as materialized(select * from public.group_demand_from_rates(player,viewer,rates))
select case when exists(select 1 from public.preferences where user_id=viewer) and exists(select 1 from d)
 then round(100*coalesce(sum(d.share) filter(where p.choice='want'),0))::int end
from d left join public.preferences p on p.user_id=viewer and p.line_id=d.line_id
$$;
create or replace function public.fit_pct(viewer uuid,player uuid)
returns int language sql stable security definer set search_path='' as $$
 select round(want_pct)::int from public.trial_pair_scores(viewer,array[player]) where direction='them'
$$;
create or replace function public.you_fit_pct(viewer uuid,player uuid)
returns int language sql stable security definer set search_path='' as $$
 select round(want_pct)::int from public.trial_pair_scores(viewer,array[player]) where direction='you'
$$;

-- A saved Neutral is still a saved vote: it yields 0% Want, not a dash.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.player_extras(uuid[])'::regprocedure);
 definition:=replace(definition,'where p.choice <> ''undecided''','');
 execute definition;
end $migration$;

-- Admin-only, on-demand diagnostics: no telemetry table or per-request writes.
-- Bins count friends with >=1 Want actually feeding each estimate, excluding
-- the receiver. At n=5 the prior and friend counts have equal pre-normalization
-- weight; their shares of normalized total demand need not be exactly 50/50.
create or replace function public.match_trial_diagnostics(viewers uuid[])
returns table(direction text,friend_bin text,pairs bigint,scored bigint,recommended bigint,
 utility_mean numeric,utility_p10 double precision,utility_p50 double precision,utility_p90 double precision,
 unwanted_mean numeric,lift_mean numeric,lift_p50 double precision)
language sql stable security definer set search_path='' as $$
with sample as materialized(
 select distinct p.id from public.profiles p where p.id=any(viewers[1:200])
), stats as materialized(
 select v.id viewer,s.* from sample v cross join lateral public.trial_pair_scores(v.id,
 array(select c.id from public.trial_candidates(v.id) c order by c.id limit 1000)) s
), eligible as(select viewer,candidate,bool_and(coalesce(utility>0,false)) good from stats group by viewer,candidate)
select s.direction,s.friend_bin,count(*),count(s.utility),count(*) filter(where e.good),avg(s.utility),
 percentile_cont(0.1) within group(order by s.utility::double precision),
 percentile_cont(0.5) within group(order by s.utility::double precision),
 percentile_cont(0.9) within group(order by s.utility::double precision),avg(s.unwanted_pct),avg(s.lift),
 percentile_cont(0.5) within group(order by s.lift::double precision)
from stats s join eligible e using(viewer,candidate) group by s.direction,s.friend_bin
$$;
revoke all on function public.match_trial_diagnostics(uuid[]) from public,anon,authenticated;

create or replace function public.my_friends_voted()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.friends f join public.preferences p on p.user_id=f.friend_id and p.choice='want' where f.user_id=auth.uid())
$$;
revoke all on function public.my_friends_voted() from public,anon;
grant execute on function public.my_friends_voted() to authenticated;

-- Publish the changed RPC result contracts atomically at transaction commit.
notify pgrst, 'reload schema';

-- These bounded interactive batches are cheaper interpreted: local 2k-player
-- EXPLAIN measured ~1.1s of JIT compilation alone. Scope this to the batch
-- functions, not the database, so larger unrelated queries keep their policy.
alter function public.trial_pair_scores(uuid,uuid[]) set jit = off;
alter function public.browse_all() set jit = off;
alter function public.get_friends(boolean) set jit = off;


commit;
