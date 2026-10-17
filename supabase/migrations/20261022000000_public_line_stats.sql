-- Public Everyone totals. The minimum is enforced here, not in the browser.
-- Count active players with a saved entry for a line, including all-Neutral
-- wishlists. No user ids or individual choices leave this function.
create or replace function public.get_public_line_stats()
returns table (line_id text, wants bigint, dont_wants bigint, tops bigint, seen bigint, voters bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with active as materialized (
    select pr.id
    from public.profiles pr
    cross join public.match_config() cfg
    where pr.last_seen_at > now() - cfg.stale_after
      and exists (select 1 from public.preferences p where p.user_id = pr.id)
  ), totals as (
    select p.line_id,
      count(*) filter (where a.id is not null and p.choice = 'want') as wants,
      count(*) filter (where a.id is not null and p.choice = 'dont_want') as dont_wants,
      count(*) filter (where a.id is not null and p.top) as tops,
      count(a.id) as seen
    from public.preferences p
    left join active a on a.id = p.user_id
    group by p.line_id
  )
  select t.line_id,
    case when t.seen >= 10 then t.wants end,
    case when t.seen >= 10 then t.dont_wants end,
    case when t.seen >= 10 then t.tops end,
    case when t.seen >= 10 then t.seen end,
    case when t.seen >= 10 then (select count(*) from active) end
  from totals t
$$;
revoke execute on function public.get_public_line_stats() from public;
grant execute on function public.get_public_line_stats() to anon, authenticated;
