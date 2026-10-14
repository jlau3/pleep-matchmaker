-- Blend every friends list with the community, so tiny like-minded lists stop
-- topping Find New Friends and brand-new players still get a fair number.
--
-- A list's demand for a line is now its friends' votes plus blend_weight()
-- "average players":
--
--   raw   = (friends wanting the line + K x community rate) / (voting friends + K)
--   share = raw / max(raw)              (scaled like before; K = blend_weight() = 5)
--
-- community rate = share of active players (with any want) who want the line,
-- cached in community_rates and refreshed at most hourly (refresh_community_rates,
-- called by the daily cron and by Find New Friends).
--
--   "For you" (their list): under 3 voting friends their friends' votes are left
--   out entirely (as before, so one friend's votes can't be worked out) and it's
--   the community alone. Their own wants no longer stand in: they say what the
--   player wants, not what they send.
--   "For them" (your list): still none until one of your friends has voted.
--
-- The "they'd send you / you'd send them" lists keep only lines at or above
-- list_share_cutoff() (0.5), since every line now has some share.
-- browse_players gains list_voters (their voting friends, 0 under 3) so the
-- page can say a list is the community average. Safe to re-run.

create table if not exists public.community_rates (
  line_id text primary key,
  rate numeric not null
);
-- No policies: only the security definer functions below read it.
alter table public.community_rates enable row level security;

create table if not exists public.community_rates_meta (
  id boolean primary key default true check (id),
  refreshed_at timestamptz not null
);
alter table public.community_rates_meta enable row level security;

create or replace function public.blend_weight()
returns numeric
language sql
immutable
as $$ select 5.0 $$;

create or replace function public.list_share_cutoff()
returns numeric
language sql
immutable
as $$ select 0.5 $$;

-- Recomputes community_rates now. Not callable by players; see refresh_community_rates.
create or replace function public.refresh_community_rates_now()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare voters numeric;
begin
  lock table public.community_rates in exclusive mode;
  create temp table if not exists pm_active (id uuid) on commit drop;
  truncate pm_active;
  insert into pm_active
  select pr.id
  from public.profiles pr
  cross join public.match_config() cfg
  where pr.last_seen_at > now() - cfg.stale_after
    and exists (select 1 from public.preferences p where p.user_id = pr.id and p.choice = 'want');
  select count(*) into voters from pm_active;
  delete from public.community_rates;
  if voters > 0 then
    insert into public.community_rates (line_id, rate)
    select p.line_id, count(*) / voters
    from public.preferences p
    join pm_active a on a.id = p.user_id
    where p.choice = 'want'
    group by p.line_id;
  end if;
  insert into public.community_rates_meta (id, refreshed_at) values (true, now())
  on conflict (id) do update set refreshed_at = excluded.refreshed_at;
end
$$;

revoke execute on function public.refresh_community_rates_now() from public, anon, authenticated;

-- Refreshes community_rates unless that happened in the last hour. Cheap no-op
-- otherwise, so the cron and page loads can call it freely.
create or replace function public.refresh_community_rates()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.community_rates_meta where refreshed_at > now() - interval '1 hour') then
    return false;
  end if;
  perform public.refresh_community_rates_now();
  return true;
end
$$;

revoke execute on function public.refresh_community_rates() from public;
grant execute on function public.refresh_community_rates() to anon, authenticated;

-- "For you": one player's list, blended. Leaves `viewer` out.
create or replace function public.their_list_demand(player uuid, viewer uuid)
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
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    where f.user_id = player and f.friend_id <> viewer
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
  ),
  -- Under 3 voting friends, theirs count as none (privacy) and it's the community alone.
  cnt as (select case when count(*) >= 3 then count(*) else 0 end::numeric as n from voters),
  votes as (
    select p.line_id, count(*)::numeric as v
    from voters vo
    join public.preferences p on p.user_id = vo.friend_id and p.choice = 'want'
    where (select n from cnt) > 0
    group by p.line_id
  ),
  raw as (
    select line_id,
           (coalesce(vt.v, 0) + public.blend_weight() * coalesce(cr.rate, 0)) / ((select n from cnt) + public.blend_weight()) as raw
    from public.community_rates cr
    full join votes vt using (line_id)
  )
  select r.line_id, r.raw / max(r.raw) over () from raw r where r.raw > 0
$$;

revoke execute on function public.their_list_demand(uuid, uuid) from public, anon, authenticated;

-- "For them": your friends' list (leaving `skip` out), blended. Nothing until a friend has voted.
create or replace function public.group_demand(viewer uuid, skip uuid default null)
returns table (line_id text, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with
  voters as (
    select distinct f.friend_id
    from public.friends f
    join public.profiles pr on pr.id = f.friend_id and pr.allow_lookup
    where f.user_id = viewer and f.friend_id is distinct from skip
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
  ),
  cnt as (select count(*)::numeric as n from voters),
  votes as (
    select p.line_id, count(*)::numeric as v
    from voters vo
    join public.preferences p on p.user_id = vo.friend_id and p.choice = 'want'
    group by p.line_id
  ),
  raw as (
    select line_id,
           (coalesce(vt.v, 0) + public.blend_weight() * coalesce(cr.rate, 0)) / ((select n from cnt) + public.blend_weight()) as raw
    from public.community_rates cr
    full join votes vt using (line_id)
  )
  select r.line_id, r.raw / max(r.raw) over () from raw r where r.raw > 0 and (select n from cnt) > 0
$$;

revoke execute on function public.group_demand(uuid, uuid) from public, anon, authenticated;

select public.refresh_community_rates_now();

drop function if exists public.browse_players(text, boolean, int, int);

create function public.browse_players(
  sort text default 'fit',
  everyone boolean default false,
  page_size int default 20,
  page_offset int default 0
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
    where pr.id <> (select id from me)
      and pr.open_to_friends
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
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_votes as materialized (
    select f.user_id as cand, f.friend_id, p.line_id
    from public.friends f
    join friend_voters v on v.cand = f.user_id and v.voters >= 3
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
    join public.preferences p on p.user_id = f.friend_id and p.choice = 'want'
    where f.friend_id <> (select id from me)
  ),
  friend_wants as (
    select fv.cand, fv.line_id, count(*)::numeric as demand
    from friend_votes fv
    group by fv.cand, fv.line_id
  ),
  -- Their list blended with the community (see the header): friends' votes plus
  -- blend_weight() average players. Under 3 voting friends it's the community alone.
  lines as (select line_id from public.community_rates union select line_id from friend_wants),
  blended as materialized (
    select
      c.id as cand,
      l.line_id,
      (coalesce(fw.demand, 0) + public.blend_weight() * coalesce(cr.rate, 0))
        / (coalesce(case when fv.voters >= 3 then fv.voters end, 0) + public.blend_weight()) as raw
    from candidates c
    cross join lines l
    left join friend_wants fw on fw.cand = c.id and fw.line_id = l.line_id
    left join public.community_rates cr on cr.line_id = l.line_id
    left join friend_voters fv on fv.cand = c.id
  ),
  demand as materialized (
    select b.cand, b.line_id, b.raw / max(b.raw) over (partition by b.cand) as share
    from blended b
    where b.raw > 0
  ),
  demand_cands as materialized (select cand, sum(share) as cap from demand group by cand),
  you_agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), coalesce(max(dc.cap), 0))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share >= public.list_share_cutoff()), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share >= public.list_share_cutoff()), '{}') as fit_dont_wants
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
        filter (where p.choice = 'want' and g.share >= public.list_share_cutoff()), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share >= public.list_share_cutoff()), '{}') as fit_dont_wants
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
      coalesce((select v.voters from friend_voters v where v.cand = c.id and v.voters >= 3), 0)::int as list_voters
    from candidates c
    left join they_agg t on t.cand = c.id
    left join you_agg y on y.cand = c.id
    left join demand_cands dc on dc.cand = c.id
  ),
  combined as (
    -- Best fit: the average of the two (either one alone when the other is unknown).
    select s.*, (coalesce(s.they_pct, s.you_pct) + coalesce(s.you_pct, s.they_pct)) / 2.0 as both_pct
    from scored s
  ),
  listed as (
    -- Good fits: neither number is a low fit, and their list wants at least min_shared_wants of yours.
    select s.*
    from combined s, cfg
    where everyone
       -- No friends' votes yet: "for them" is unknown, so only "for you" counts.
       or (coalesce(s.they_pct, s.you_pct) >= cfg.min_pct and s.you_pct >= cfg.min_pct
           and cardinality(s.you_wants) >= cfg.min_shared_wants)
  )
  select
    l.id,
    case when l.show_discord then l.discord_username end,
    case when l.show_discord then l.discord_display_name end,
    case when l.show_discord then l.avatar_url end,
    l.ign,
    l.friend_code,
    l.last_seen_at,
    l.prefs_updated_at,
    l.they_pct,
    l.they_wants,
    l.they_dont_wants,
    l.you_pct,
    l.you_wants,
    l.you_dont_wants,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = l.id and p.top), '{}'),
    l.list_voters,
    count(*) over ()
  from listed l
  order by
    case when sort = 'active' then l.last_seen_at end desc nulls last,
    case when sort = 'you_fit' then l.you_pct end desc nulls last,
    case when sort = 'they_fit' then l.they_pct end desc nulls last,
    l.both_pct desc nulls last,
    cardinality(l.you_wants) desc,
    l.last_seen_at desc,
    l.id
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0)
$$;

revoke execute on function public.browse_players(text, boolean, int, int) from public, anon;
grant execute on function public.browse_players(text, boolean, int, int) to authenticated;

