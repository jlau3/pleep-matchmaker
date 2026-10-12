-- Match % with each friend, shown on the friends list.
--
-- pair_match_pct scores two players with exactly the get_matches formula
-- (including the Top 3 multiplier) but without its thresholds, so it works
-- for any friend. It is internal: only security definer functions call it.
-- Friends who turned lookup off get no %, same as their hidden picks.

create function public.pair_match_pct(a uuid, b uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  mine as (
    select line_id, choice, top from public.preferences where user_id = a and choice <> 'undecided'
  ),
  theirs as (
    select line_id, choice, top from public.preferences where user_id = b and choice <> 'undecided'
  ),
  scored as (
    select m.choice as ca, t.choice as cb,
           case when coalesce(m.top, false) or coalesce(t.top, false) then public.top_multiplier() else 1 end as mult
    from mine m
    full join theirs t on t.line_id = m.line_id
  ),
  agg as (
    select
      sum(s.mult * case
            when s.ca = 'want' and s.cb = 'want' then cfg.w_both_want
            when s.ca = 'dont_want' and s.cb = 'dont_want' then cfg.w_both_dont
            when (s.ca = 'want' and s.cb = 'dont_want') or (s.ca = 'dont_want' and s.cb = 'want') then cfg.w_conflict
            else 0
          end) as score,
      sum(s.mult * case when s.ca = 'want' or s.cb = 'want' then cfg.w_both_want else cfg.w_both_dont end) as best
    from scored s, cfg
  )
  select case when best > 0 then round(100.0 * greatest(score, 0) / best)::int end from agg
$$;

revoke execute on function public.pair_match_pct(uuid, uuid) from public, anon, authenticated;

drop function public.get_friends();

create function public.get_friends()
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
    case when pr.allow_lookup then public.pair_match_pct(auth.uid(), pr.id) end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

revoke execute on function public.get_friends() from public, anon;
grant execute on function public.get_friends() to authenticated;
