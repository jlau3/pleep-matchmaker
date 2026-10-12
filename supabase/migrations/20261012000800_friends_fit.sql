-- Match % becomes "fit": how well a player's wants line up with what your
-- friends want, not with your own votes. Used by Find New, player search
-- and My Friends. Also adds "they stopped playing" reports from removing a
-- friend, which keep inactive players out of Find New. Safe to re-run.
--
-- Group demand per line = how many of your friends want it, with a starred
-- want counting top_multiplier() times (the Tier List's demand). Only friends
-- whose lists are visible (allow_lookup) count. Each line's share is its
-- demand relative to your friends' most-wanted line (0..1].
--
--   fit % = sum over their wants of weight x share / sum of their want weights
--
-- (weight = top_multiplier() for a starred want, else 1). 100% means
-- everything they want is among your friends' most-wanted candy; lines your
-- friends don't want count 0. Don't-wants and undecided don't matter: they
-- won't take that candy either way. With no friends' votes yet, your own
-- wants stand in for the group.

create or replace function public.group_demand(viewer uuid, skip uuid default null)
returns table (line_id text, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with
  friend_wants as (
    select p.line_id, sum(case when p.top then public.top_multiplier() else 1 end)::numeric as demand
    from public.friends f
    join public.profiles pr on pr.id = f.friend_id and pr.allow_lookup
    join public.preferences p on p.user_id = f.friend_id and p.choice = 'want'
    where f.user_id = viewer and f.friend_id is distinct from skip
    group by p.line_id
  ),
  own_wants as (
    select p.line_id, (case when p.top then public.top_multiplier() else 1 end)::numeric as demand
    from public.preferences p
    where p.user_id = viewer and p.choice = 'want' and not exists (select 1 from friend_wants)
  ),
  d as (select * from friend_wants union all select * from own_wants)
  select d.line_id, d.demand / max(d.demand) over () from d
$$;

-- Fit of one player with the viewer's friends. When the player is already a
-- friend, the rest of the friends list is the group (they don't count toward
-- their own fit). Null when there's nothing to compare: no group demand yet,
-- or the player wants nothing.
create or replace function public.fit_pct(viewer uuid, player uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  g as (select * from public.group_demand(viewer, player)),
  theirs as (
    select p.line_id, case when p.top then public.top_multiplier() else 1 end as w
    from public.preferences p
    where p.user_id = player and p.choice = 'want'
  )
  select case when exists (select 1 from g) and sum(t.w) > 0
    then round(100.0 * sum(t.w * coalesce(g.share, 0)) / sum(t.w))::int end
  from theirs t
  left join g on g.line_id = t.line_id
$$;

revoke execute on function public.group_demand(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fit_pct(uuid, uuid) from public, anon, authenticated;


-- "They stopped playing", from removing a friend. A report counts while the
-- player hasn't been back since it was made. Find New hides a player you
-- reported, and hides them from everyone at inactive_reports_to_hide() reports.
create table if not exists public.inactive_reports (
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reporter_id, player_id),
  check (reporter_id <> player_id)
);

create index if not exists inactive_reports_player_idx on public.inactive_reports (player_id, created_at);

alter table public.inactive_reports enable row level security;
revoke all on public.inactive_reports from anon, authenticated;
grant select, delete on public.inactive_reports to authenticated;

drop policy if exists "own reports read" on public.inactive_reports;
create policy "own reports read" on public.inactive_reports
  for select to authenticated using (reporter_id = (select auth.uid()));
drop policy if exists "own reports delete" on public.inactive_reports;
create policy "own reports delete" on public.inactive_reports
  for delete to authenticated using (reporter_id = (select auth.uid()));

create or replace function public.inactive_reports_to_hide()
returns int
language sql
immutable
as $$ select 2 $$;

-- Writes go through here so a repeat report moves its timestamp forward
-- (a player who came back and went quiet again can be reported again).
create or replace function public.report_inactive(player uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.inactive_reports (reporter_id, player_id)
  select auth.uid(), player
  where auth.uid() is not null and player <> auth.uid()
  on conflict (reporter_id, player_id) do update set created_at = now()
$$;

revoke execute on function public.report_inactive(uuid) from public, anon;
grant execute on function public.report_inactive(uuid) to authenticated;


drop function if exists public.get_matches();

create function public.get_matches()
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
  fit_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  g as (select * from public.group_demand((select id from me))),
  -- Prune: a match needs min_shared_wants wants your friends want too.
  sharers as (
    select p.user_id
    from public.preferences p
    join g on g.line_id = p.line_id
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
      and not exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = pr.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
      -- Reported inactive and not back since: by you, or by enough people.
      and not exists (
        select 1 from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at and r.reporter_id = (select id from me)
      )
      and (
        select count(*) from public.inactive_reports r
        where r.player_id = pr.id and r.created_at > pr.last_seen_at
      ) < public.inactive_reports_to_hide()
  ),
  agg as (
    select
      p.user_id,
      sum((case when p.top then public.top_multiplier() else 1 end) * coalesce(g.share, 0)) as hit,
      sum(case when p.top then public.top_multiplier() else 1 end) as total,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id) filter (where g.share is not null), '{}') as fit_wants
    from public.preferences p
    join candidates c on c.id = p.user_id
    left join g on g.line_id = p.line_id
    where p.choice = 'want'
    group by p.user_id
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
    round(100.0 * a.hit / a.total)::int as match_pct,
    a.fit_wants
  from agg a
  join candidates c on c.id = a.user_id
  cross join cfg
  where 100.0 * a.hit / a.total >= cfg.min_pct
  order by match_pct desc, cardinality(a.fit_wants) desc, c.last_seen_at desc
  limit 100
$$;

revoke execute on function public.get_matches() from public, anon;
grant execute on function public.get_matches() to authenticated;


create or replace function public.get_friends(with_match boolean default true)
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
    case when with_match and pr.allow_lookup then public.fit_pct(auth.uid(), pr.id) end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;


create or replace function public.lookup_players(q text)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
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
  with
  needle as (
    select
      public.search_key(trim(both '@ ' from q)) as text_q,
      nullif(regexp_replace(q, '[^0-9]', '', 'g'), '') as digits_q
  ),
  hits as (
    select pr.*
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and (
        public.search_key(pr.discord_username) = n.text_q
        or public.search_key(pr.discord_display_name) = n.text_q
        or public.search_key(pr.ign) = n.text_q
        or (char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q)
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
    limit 20
  )
  select
    h.id,
    h.discord_username,
    h.discord_display_name,
    h.avatar_url,
    h.ign,
    h.friend_code,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}'),
    case when h.id <> auth.uid() then public.fit_pct(auth.uid(), h.id) end
  from hits h
  order by h.last_seen_at desc
$$;

-- Nothing calls the old pairwise score any more.
drop function if exists public.pair_match_pct(uuid, uuid);
