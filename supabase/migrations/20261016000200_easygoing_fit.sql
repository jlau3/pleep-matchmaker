-- Easygoing players (who want lots of candy) no longer get low fits for it.
--
-- Both fits divided the candy that matches by EVERY line the player wants, so
-- wanting 60 lines meant 60 lines had to be in demand to score 100%, while
-- someone wanting only the 3 most popular lines scored 100% easily. A friends
-- list only sends so much: its "capacity" is the sum of its demand shares
-- (1 for the most wanted line, less for the rest). The want count in the
-- denominator is now capped at that capacity:
--
--   fit % = matched demand / (least(wants, capacity) + dont_want_weight() x don't-wants hit)
--
-- Narrow wishlists score as before; broad ones are judged on the candy the
-- list can actually send. Still at most 100%. Same signatures. Safe to re-run.

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

create or replace function public.you_fit_pct(viewer uuid, player uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with
  d as (select * from public.their_list_demand(player, viewer)),
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

revoke execute on function public.fit_pct(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.you_fit_pct(uuid, uuid) from public, anon, authenticated;

create or replace function public.browse_players(
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
  demand as materialized (
    select fw.cand, fw.line_id, fw.demand / max(fw.demand) over (partition by fw.cand) as share
    from friend_wants fw
    union all
    -- Fewer than 3 friends with votes: their own wants stand in.
    select p.user_id, p.line_id, 1::numeric
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice = 'want'
      and not exists (select 1 from friend_voters v where v.cand = p.user_id and v.voters >= 3)
  ),
  demand_cands as materialized (select cand, sum(share) as cap from demand group by cand),
  you_agg as (
    select
      c.id as cand,
      coalesce(sum(coalesce(d.share, 0)) filter (where m.choice = 'want'), 0) as hit,
      least(count(*) filter (where m.choice = 'want'), coalesce(max(dc.cap), 0))
        + public.dont_want_weight() * coalesce(sum(d.share) filter (where m.choice = 'dont_want'), 0) as total,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'want' and d.share is not null), '{}') as fit_wants,
      coalesce(array_agg(m.line_id order by d.share desc, m.line_id)
        filter (where m.choice = 'dont_want' and d.share is not null), '{}') as fit_dont_wants
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
        filter (where p.choice = 'want' and g.share is not null), '{}') as fit_wants,
      coalesce(array_agg(p.line_id order by g.share desc, p.line_id)
        filter (where p.choice = 'dont_want' and g.share is not null), '{}') as fit_dont_wants
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
      coalesce(y.fit_dont_wants, '{}') as you_dont_wants
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
       or (s.they_pct >= cfg.min_pct and s.you_pct >= cfg.min_pct and cardinality(s.you_wants) >= cfg.min_shared_wants)
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
