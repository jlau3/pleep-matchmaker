-- Number of active players (seen within match_config().stale_after) with at
-- least one want or don't-want vote. Denominator for the "Everyone" tier list.

create function public.get_voter_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct p.user_id)
  from public.preferences p
  join public.profiles pr on pr.id = p.user_id
  cross join public.match_config() cfg
  where p.choice <> 'undecided'
    and pr.last_seen_at > now() - cfg.stale_after
$$;

revoke execute on function public.get_voter_count() from public, anon;
grant execute on function public.get_voter_count() to authenticated;
