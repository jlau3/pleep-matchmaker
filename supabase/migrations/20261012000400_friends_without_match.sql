-- get_friends(with_match): the Tier List only needs friends' votes, so it
-- passes false and skips pair_match_pct for every friend. My Friends keeps
-- the default (true). Safe to re-run.

drop function if exists public.get_friends();
drop function if exists public.get_friends(boolean);

create function public.get_friends(with_match boolean default true)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  added_at timestamptz,
  visible boolean,
  wants text[],
  dont_wants text[],
  top_wants text[],
  match_pct int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    pr.discord_username,
    pr.discord_display_name,
    pr.avatar_url,
    case when pr.allow_lookup then pr.ign end,
    case when pr.allow_lookup then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    pr.allow_lookup,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end,
    case when with_match and pr.allow_lookup then public.pair_match_pct(auth.uid(), pr.id) end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

revoke execute on function public.get_friends(boolean) from public, anon;
grant execute on function public.get_friends(boolean) to authenticated;
