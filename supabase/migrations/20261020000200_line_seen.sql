-- Crowd picks measured against who has seen a line. get_line_stats also
-- counts, per line, the active voters with any vote on it, Neutral included:
-- opening My Votes saves every line you haven't voted on as Neutral, so this
-- is everyone who's been asked. A new line's count starts small and grows as
-- players come back, instead of its wants being measured against players who
-- haven't seen it yet. Same voters as get_voter_count. Safe to re-run.

drop function if exists public.get_line_stats();

create function public.get_line_stats()
returns table (line_id text, wants bigint, dont_wants bigint, tops bigint, seen bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with voters as (
    select pr.id
    from public.profiles pr
    cross join public.match_config() cfg
    where pr.last_seen_at > now() - cfg.stale_after
      and exists (select 1 from public.preferences v where v.user_id = pr.id and v.choice <> 'undecided')
  )
  select p.line_id,
         count(*) filter (where p.choice = 'want'),
         count(*) filter (where p.choice = 'dont_want'),
         count(*) filter (where p.top),
         count(*)
  from public.preferences p
  join voters v on v.id = p.user_id
  group by p.line_id
$$;
revoke execute on function public.get_line_stats() from public, anon;
grant execute on function public.get_line_stats() to authenticated;
