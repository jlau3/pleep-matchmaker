-- Profile extras. Safe to re-run.
--
-- 1. votes_private: your wants, don't-wants and Top 3 show only to people on
--    your friend list (you added them) and to you. Search, Find New and other
--    people's My Friends get empty lists; match %s and the anonymous Everyone
--    Tier List are unchanged.
-- 2. game_avatar: an in-game profile icon ("pikachu:happy_shiny"), shown in
--    place of the Discord picture. Art from Neroli's Lab (public/avatars).
-- 3. reddit_username: a Reddit handle shown next to the Discord name. Typed by
--    the player, so not verified.
-- 2 and 3 reach other players through player_extras(ids), next to the rows the
-- other functions already return.

alter table public.profiles add column if not exists votes_private boolean not null default false;
alter table public.profiles add column if not exists game_avatar text;
alter table public.profiles add column if not exists reddit_username text;

alter table public.profiles drop constraint if exists profiles_game_avatar_format;
alter table public.profiles add constraint profiles_game_avatar_format
  check (game_avatar is null or game_avatar ~ '^[a-z0-9_]{1,40}:(normal|shiny|happy|happy_shiny)$');
alter table public.profiles drop constraint if exists profiles_reddit_username_format;
alter table public.profiles add constraint profiles_reddit_username_format
  check (reddit_username is null or reddit_username ~ '^[A-Za-z0-9_-]{3,20}$');

grant update (votes_private, game_avatar, reddit_username) on public.profiles to authenticated;

-- Whether the caller may see this player's votes.
create or replace function public.shows_votes(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select owner = auth.uid()
    or not coalesce((select pr.votes_private from public.profiles pr where pr.id = owner), false)
    or exists (select 1 from public.friends f where f.user_id = owner and f.friend_id = auth.uid())
$$;

revoke execute on function public.shows_votes(uuid) from public, anon;
grant execute on function public.shows_votes(uuid) to authenticated;

-- Icon and Reddit name for players the caller already sees (search, Find New,
-- friends, added you, pending), skipping blocks either way.
create or replace function public.player_extras(ids uuid[])
returns table (user_id uuid, game_avatar text, reddit_username text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.game_avatar, pr.reddit_username
  from public.profiles pr
  where pr.id = any(ids[1:200])
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
         or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
    )
$$;

revoke execute on function public.player_extras(uuid[]) from public, anon;
grant execute on function public.player_extras(uuid[]) to authenticated;

-- lookup_players as in friends_upkeep, lists hidden by shows_votes.
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
  match_pct int,
  you_fit_pct int
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
  -- Each findable name's key (Discord names only when shown), scored against the query:
  -- 1 for an exact match, else pg_trgm word similarity (typos, partial names).
  scored as (
    select pr.*,
      greatest(
        case when pr.show_discord then public.name_match(pr.discord_username, n.text_q) end,
        case when pr.show_discord then public.name_match(pr.discord_display_name, n.text_q) end,
        public.name_match(pr.ign, n.text_q),
        case when char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q then 1 end
      ) as score,
      coalesce(char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q, false) as code_hit
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
  ),
  -- Exact matches from 2 characters; close ones from 3, at most 10, best first.
  hits as (
    select s.*
    from scored s, needle n
    -- You only find yourself by exact name (the page then says "That's you").
    where s.score = 1 or (s.id <> auth.uid() and char_length(n.text_q) >= 3 and s.score >= public.fuzzy_name_min())
    order by s.score desc, s.last_seen_at desc
    limit 10
  )
  select
    h.id,
    case when h.show_discord then h.discord_username end,
    case when h.show_discord then h.discord_display_name end,
    case when h.show_discord then h.avatar_url end,
    h.ign,
    -- Closed to new friends: the code shows only to someone who typed it, to
    -- friends (either way round), and to themselves.
    case when h.open_to_friends or h.code_hit or h.id = auth.uid()
           or exists (select 1 from public.friends f
                      where (f.user_id = auth.uid() and f.friend_id = h.id)
                         or (f.user_id = h.id and f.friend_id = auth.uid()))
         then h.friend_code end,
    h.last_seen_at,
    h.prefs_updated_at,
    case when public.shows_votes(h.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}') else '{}' end,
    case when public.shows_votes(h.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when public.shows_votes(h.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}') else '{}' end,
    case when h.id <> auth.uid() then public.fit_pct(auth.uid(), h.id) end,
    case when h.id <> auth.uid() then public.you_fit_pct(auth.uid(), h.id) end
  from hits h
  order by h.score desc, h.last_seen_at desc
$$;

-- browse_players as in best_match_sum, their lists and Top 3 hidden by shows_votes.
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
  list_voters int,
  voted boolean,
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
    case when public.shows_votes(l.id) then l.they_wants else '{}' end,
    case when public.shows_votes(l.id) then l.they_dont_wants else '{}' end,
    l.you_pct,
    l.you_wants,
    l.you_dont_wants,
    case when public.shows_votes(l.id) then coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = l.id and p.top), '{}') else '{}' end,
    l.list_voters,
    l.voted,
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

-- get_friends as in two_way_fit; a private friend who hasn't added you back shows as private.
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
  match_pct int,
  you_fit_pct int,
  added_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    case when pr.show_discord then pr.discord_username end,
    case when pr.show_discord then pr.discord_display_name end,
    case when pr.show_discord then pr.avatar_url end,
    case when pr.allow_lookup then pr.ign end,
    case when pr.allow_lookup then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    pr.allow_lookup and public.shows_votes(pr.id),
    case when pr.allow_lookup and public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when pr.allow_lookup and public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when pr.allow_lookup and public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end,
    case when with_match and pr.allow_lookup then public.fit_pct(auth.uid(), pr.id) end,
    case when with_match and pr.allow_lookup then public.you_fit_pct(auth.uid(), pr.id) end,
    exists (select 1 from public.friends back where back.user_id = pr.id and back.friend_id = auth.uid())
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;
