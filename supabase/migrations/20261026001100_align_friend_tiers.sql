-- Align Spotlight badges and filter eligibility with the actual Percentile Tier List.
-- Historical migrations remain intact. Neutral-only saved voters count; zero is C.
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
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id )
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
  -- Same friend electorate as the actual Tier List, including the viewer if friends.
  fr as materialized (
    select f.user_id as cand, f.friend_id,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id ) as voted
    from cands c
    join public.friends f on f.user_id = c.id
    join public.profiles fp on fp.id = f.friend_id
  ),
  -- A Tier List exists as soon as any friend has a saved vote, including Neutral.
  nv as materialized (
    select fr.cand, (count(*) filter (where fr.voted))::int as n
    from fr
    group by fr.cand
    having count(*) filter (where fr.voted) > 0
  ),
  votes as materialized (
    select fr.cand, p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d
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
  -- Match the actual Percentile Tier List: zero/unvoted is C, only negative is F.
  -- No voting friends means no list and no rows, rather than an invented C.
  select nv.cand, tp.line_id, case when coalesce(s.score, 0) < 0 then 'Avoid' when coalesce(s.score, 0) = 0 then 'C' else t.tier end
  from nv
  cross join tops tp
  left join votes vo on vo.cand = nv.cand and vo.line_id = tp.line_id
  left join scored s on s.cand = nv.cand and s.line_id = tp.line_id
  left join tiered t on t.cand = nv.cand and t.score = s.score
$$;

-- Caller-owned metadata, separate from contact/score contracts. No votes are exposed.
create or replace function public.get_friend_voters()
returns table(user_id uuid)
language sql stable security definer set search_path='' as $$
 select f.friend_id from public.friends f
 where f.user_id=auth.uid() and public.shows_votes(f.friend_id)
 and exists(select 1 from public.preferences p where p.user_id=f.friend_id)
$$;
revoke all on function public.get_friend_voters() from public,anon;
grant execute on function public.get_friend_voters() to authenticated;
notify pgrst, 'reload schema';
