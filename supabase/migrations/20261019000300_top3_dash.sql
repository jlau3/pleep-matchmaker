-- Your Top 3 on their Tier List, a dash where "for you" has nothing: a tier
-- only when their list counts (3+ of their friends besides you have voted
-- Want on something, as for "for you") and some of those friends want that
-- line. Before, a list with no Wants ranked every unvoted line S. The sort
-- counts only real tiers, so all-dash players fall back to Best match.
-- Safe to re-run.

create or replace function public.top3_tiers_for(player uuid, viewer uuid, line_count int)
returns table (line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  -- Their friends (not you) who are findable and want something: their list for "for you".
  voters as (
    select f.friend_id
    from public.friends f
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    where f.user_id = player and f.friend_id <> viewer
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
  ),
  lt as (select * from public.list_tiers(player, line_count))
  select p.line_id, (select lt.tier from lt where lt.line_id = p.line_id)
  from public.preferences p
  where p.user_id = viewer and p.top
    and (select count(*) from voters) >= 3
    and exists (
      select 1 from public.preferences w
      join voters v on v.friend_id = w.user_id
      where w.line_id = p.line_id and w.choice = 'want'
    )
$$;
revoke execute on function public.top3_tiers_for(uuid, uuid, int) from public, anon, authenticated;
