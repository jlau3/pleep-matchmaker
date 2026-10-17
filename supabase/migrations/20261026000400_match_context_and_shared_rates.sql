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
