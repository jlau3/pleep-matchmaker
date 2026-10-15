-- Find New sorts, filters and pages in the browser: browse_all returns every
-- player browse_players would list under Everyone (up to 1000, best match
-- first), with both_pct, whether each is a good match, and the card extras
-- (icon, Reddit name, friends-only votes), so switching sort, Good matches /
-- Everyone or page needs no round trip. Same scoring as browse_players
-- (20261020000000_top3_fast.sql), which stays for older app versions.
--
-- Your Top 3 sort needs every player's tiers: top3_tiers and top3_tiers_set
-- take up to 1000 players (was 50 and 500). Safe to re-run.

drop function if exists public.browse_all();

create function public.browse_all()
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
  voted boolean,
  both_pct int,
  good boolean,
  game_avatar text,
  reddit_username text,
  votes_hidden boolean
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
  -- Their list needs 3+ friends who've voted (friend_votes only reads those);
  -- below that "for you" stays a dash. Their own wants don't stand in.
  demand as materialized (
    select fw.cand, fw.line_id, fw.demand / max(fw.demand) over (partition by fw.cand) as share
    from friend_wants fw
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
      coalesce(y.fit_dont_wants, '{}') as you_dont_wants,
      coalesce((select v.voters from friend_voters v where v.cand = c.id and v.voters >= 3), 0)::int as list_voters,
      exists (select 1 from public.preferences p where p.user_id = c.id and p.choice <> 'undecided') as voted
    from candidates c
    left join they_agg t on t.cand = c.id
    left join you_agg y on y.cand = c.id
    left join demand_cands dc on dc.cand = c.id
  ),
  combined as (
    -- Best match: the two added up, a missing one counting as 0, so a dash on
    -- either side can't ride the other number to the top. Both missing: last.
    select s.*,
      case when s.they_pct is null and s.you_pct is null then null
           else coalesce(s.they_pct, 0) + coalesce(s.you_pct, 0) end as both_pct
    from scored s
  )
  select
    s.id,
    case when s.show_discord then s.discord_username end,
    case when s.show_discord then s.discord_display_name end,
    case when s.show_discord then s.avatar_url end,
    s.ign,
    s.friend_code,
    s.last_seen_at,
    s.prefs_updated_at,
    s.they_pct,
    case when public.shows_votes(s.id) then s.they_wants else '{}' end,
    case when public.shows_votes(s.id) then s.they_dont_wants else '{}' end,
    s.you_pct,
    s.you_wants,
    s.you_dont_wants,
    case when public.shows_votes(s.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = s.id and p.top), '{}') else '{}' end,
    s.list_voters,
    s.voted,
    s.both_pct::int,
    -- Good fits: neither number is a low fit, and their list wants at least min_shared_wants of yours.
    -- No friends' votes yet: "for them" is unknown, so only "for you" counts.
    coalesce(coalesce(s.they_pct, s.you_pct) >= cfg.min_pct and s.you_pct >= cfg.min_pct
      and cardinality(s.you_wants) >= cfg.min_shared_wants, false),
    s.game_avatar,
    s.reddit_username,
    not public.shows_votes(s.id)
  from combined s, cfg
  -- Best match order, so a capped list keeps the best.
  order by s.both_pct desc nulls last, cardinality(s.you_wants) desc, s.last_seen_at desc, s.id
  limit 1000
$$;
revoke execute on function public.browse_all() from public, anon;
grant execute on function public.browse_all() to authenticated;

-- Your starred lines' tiers on each player's Tier List (as 20261020000000_top3_fast.sql),
-- for up to 1000 players.
create or replace function public.top3_tiers_set(players uuid[], viewer uuid, line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  tops as (select p.line_id from public.preferences p where p.user_id = viewer and p.top),
  cands as (
    select distinct c.id from unnest(players[1:1000]) as c(id)
    where exists (select 1 from tops)
  ),
  -- Everyone on each list (as list_tiers: their findable friends, you
  -- included), one row per friendship: cheap next to one per vote.
  fr as materialized (
    select f.user_id as cand, f.friend_id,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice <> 'undecided') as voted,
      exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want') as wants
    from cands c
    join public.friends f on f.user_id = c.id
    join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
  ),
  -- Lists that count: 3+ of their friends besides you want something ("for you").
  nv as materialized (
    select fr.cand, (count(*) filter (where fr.voted))::int as n
    from fr
    group by fr.cand
    having count(*) filter (where fr.wants and fr.friend_id <> viewer) >= 3
  ),
  votes as materialized (
    select fr.cand, p.line_id,
      count(*) filter (where p.choice = 'want')::int as w,
      count(*) filter (where p.choice = 'dont_want')::int as d,
      bool_or(p.choice = 'want' and fr.friend_id <> viewer) as wanted
    from fr
    join nv on nv.cand = fr.cand
    join public.preferences p on p.user_id = fr.friend_id and p.choice <> 'undecided'
    group by fr.cand, p.line_id
  ),
  -- POINTS: Want +3, Neutral +1 (everyone else), Don't Want -3. cnt: how many lines share the row ('' = unvoted lines).
  scored as (
    select vo.cand, vo.line_id, 3 * vo.w + (nv.n - vo.w - vo.d) - 3 * vo.d as score, 1 as cnt
    from votes vo join nv on nv.cand = vo.cand
    union all
    select nv.cand, '', nv.n, line_count - count(vo.line_id)::int
    from nv
    left join votes vo on vo.cand = nv.cand
    group by nv.cand, nv.n
    having line_count > count(vo.line_id)
  ),
  runs as (select s.cand, s.score, sum(s.cnt)::int as size from scored s where s.score >= 0 group by s.cand, s.score),
  pos as (
    select r.cand, r.score, r.size,
      coalesce(sum(r.size) over (partition by r.cand order by r.score desc rows between unbounded preceding and 1 preceding), 0)::int as start,
      sum(r.size) over (partition by r.cand)::int as n
    from runs r
  ),
  -- A run of tied lines takes the tier of its middle position; the best run is always S.
  tiered as (
    select p.cand, p.score,
      case
        when p.start = 0 then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8) * p.n) then 'S'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8) * p.n) then 'A'
        when (p.start + p.start + p.size - 1) / 2 < ceil((0.2::float8 + 0.25::float8 + 0.3::float8) * p.n) then 'B'
        else 'C'
      end as tier
    from pos p
  )
  -- A wanted line always has its own row in votes, so never the '' row.
  select vo.cand, vo.line_id, case when s.score < 0 then 'Avoid' else t.tier end
  from votes vo
  join tops tp on tp.line_id = vo.line_id
  join scored s on s.cand = vo.cand and s.line_id = vo.line_id
  left join tiered t on t.cand = s.cand and t.score = s.score
  where vo.wanted
$$;
revoke execute on function public.top3_tiers_set(uuid[], uuid, int) from public, anon, authenticated;

-- My Friends' cards and Find New's Top 3 sort: up to 1000 findable, unblocked players.
create or replace function public.top3_tiers(players uuid[], line_count int)
returns table (user_id uuid, line_id text, tier text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.user_id, t.line_id, t.tier
  from public.top3_tiers_set(
    array(
      select pr.id from public.profiles pr
      where pr.id = any(players[1:1000])
        and pr.allow_lookup
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
             or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
        )
    ),
    auth.uid(),
    line_count
  ) t
$$;
revoke execute on function public.top3_tiers(uuid[], int) from public, anon;
grant execute on function public.top3_tiers(uuid[], int) to authenticated;

