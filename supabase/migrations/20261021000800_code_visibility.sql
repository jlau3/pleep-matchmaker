-- Who can see your friend code, as one setting with four levels
-- (profiles.code_visibility), each a subset of the one before:
--   'matches' (default)  anyone who finds you: Find New, search, requests
--   'search'             people who search you, and friends; not Find New
--   'friends'            friends only
--   'nobody'             not even friends
-- At every level you see your own, and so does someone who typed it in
-- search. A request you send carries it to that player unless 'nobody'.
-- Replaces the share_code switch (20261021000100): share_code off, or closed
-- to new friends (the old rule), becomes 'friends'. Safe to re-run.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'code_visibility'
  ) then
    alter table public.profiles add column code_visibility text not null default 'matches'
      check (code_visibility in ('matches', 'search', 'friends', 'nobody'));
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'share_code'
    ) then
      execute $u$update public.profiles set code_visibility = 'friends' where not share_code or not open_to_friends$u$;
    else
      update public.profiles set code_visibility = 'friends' where not open_to_friends;
    end if;
  end if;
end
$$;
grant update (code_visibility) on public.profiles to authenticated;

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
        case when public.shows_discord(pr.id, pr.show_discord) then public.name_match(pr.discord_username, n.text_q) end,
        case when public.shows_discord(pr.id, pr.show_discord) then public.name_match(pr.discord_display_name, n.text_q) end,
        public.name_match(pr.ign, n.text_q),
        case when char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q then 1 end
      ) as score,
      coalesce(char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q, false) as code_hit
    from public.profiles pr, needle n
    where pr.allow_lookup
      and n.text_q <> ''
      -- Searching needs your own IGN and friend code (20261021000700).
      and exists (select 1 from public.profiles me where me.id = auth.uid() and me.ign is not null and me.friend_code is not null)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
  ),
  -- Exact matches at any length; close ones from 3 characters, at most 10, best first.
  hits as (
    select s.*
    from scored s, needle n
    -- You only find yourself by exact name (the page then says "That's you").
    where s.score = 1
       or (s.id <> auth.uid() and s.score >= 0.95)
       or (s.id <> auth.uid() and char_length(n.text_q) >= 3 and s.score >= public.fuzzy_name_min())
    order by s.score desc, s.last_seen_at desc
    limit 10
  )
  select
    h.id,
    case when public.shows_discord(h.id, h.show_discord) then h.discord_username end,
    case when public.shows_discord(h.id, h.show_discord) then h.discord_display_name end,
    case when public.shows_discord(h.id, h.show_discord) then h.avatar_url end,
    h.ign,
    -- The code: to whoever typed it, to themselves, to searchers at 'matches' or
    -- 'search', and to friends unless 'nobody' (code_visibility).
    case when h.code_hit or h.id = auth.uid() or h.code_visibility in ('matches', 'search')
           or (h.code_visibility = 'friends' and exists (select 1 from public.friends f
                      where (f.user_id = auth.uid() and f.friend_id = h.id)
                         or (f.user_id = h.id and f.friend_id = auth.uid())))
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
    case when public.shows_discord(pr.id, pr.show_discord) then pr.discord_username end,
    case when public.shows_discord(pr.id, pr.show_discord) then pr.discord_display_name end,
    case when public.shows_discord(pr.id, pr.show_discord) then pr.avatar_url end,
    pr.ign,
    case when pr.code_visibility <> 'nobody' then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    public.shows_votes(pr.id),
    case when public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when public.shows_votes(pr.id) then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end,
    case when with_match then public.fit_pct(auth.uid(), pr.id) end,
    case when with_match then public.you_fit_pct(auth.uid(), pr.id) end,
    exists (select 1 from public.friends back where back.user_id = pr.id and back.friend_id = auth.uid())
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

create or replace function public.get_friend_requests(with_fit boolean default false)
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  requested_at timestamptz,
  match_pct int,
  you_fit_pct int
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
    pr.ign,
    case when pr.code_visibility <> 'nobody' then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    r.created_at,
    case when with_fit then public.fit_pct(auth.uid(), pr.id) end,
    case when with_fit then public.you_fit_pct(auth.uid(), pr.id) end
  from public.friend_requests r
  join public.profiles pr on pr.id = r.from_id
  where r.to_id = auth.uid()
    and r.status = 'open'
    and r.created_at > now() - public.request_ttl()
    and not exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = r.from_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.from_id)
         or (b.blocker_id = r.from_id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc
$$;

create or replace function public.get_sent_requests()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  requested_at timestamptz,
  status text
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
    pr.ign,
    case when pr.code_visibility in ('matches', 'search') then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    r.created_at,
    case when r.status = 'open' and r.created_at <= now() - public.request_ttl() then 'expired' else r.status end
  from public.friend_requests r
  join public.profiles pr on pr.id = r.to_id
  where r.from_id = auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.to_id)
         or (b.blocker_id = r.to_id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc
$$;

create or replace function public.get_matches()
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
  fit_dont_wants text[]
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
      coalesce(sum(coalesce(g.share, 0)) filter (where p.choice = 'want'), 0) as hit,
      count(*) filter (where p.choice = 'want')
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
  )
  select
    c.id,
    case when public.shows_discord(c.id, c.show_discord) then c.discord_username end,
    case when public.shows_discord(c.id, c.show_discord) then c.discord_display_name end,
    case when public.shows_discord(c.id, c.show_discord) then c.avatar_url end,
    c.ign,
    case when c.code_visibility = 'matches' then c.friend_code end,
    c.last_seen_at,
    c.prefs_updated_at,
    round(100.0 * a.hit / a.total)::int as match_pct,
    a.fit_wants,
    a.fit_dont_wants
  from agg a
  join candidates c on c.id = a.user_id
  cross join cfg
  where a.total > 0 and 100.0 * a.hit / a.total >= cfg.min_pct
  order by match_pct desc, cardinality(a.fit_wants) desc, c.last_seen_at desc
  limit 100
$$;

create or replace function public.browse_players(
  sort text default 'fit',
  everyone boolean default false,
  page_size int default 20,
  page_offset int default 0,
  line_count int default 0
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
  top3_tiers jsonb,
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
      -- Strangers only see an IGN, so no IGN: not suggested.
      and pr.ign is not null
      -- Not findable by search: not suggested either.
      and pr.allow_lookup
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
    join public.profiles fp on fp.id = f.friend_id
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_votes as materialized (
    select f.user_id as cand, f.friend_id, p.line_id
    from public.friends f
    join friend_voters v on v.cand = f.user_id and v.voters >= 3
    join public.profiles fp on fp.id = f.friend_id
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
  ),
  -- Your Top 3's tiers on each listed player's Tier List, all at once; only
  -- read when sorting by them (a one-time filter skips it otherwise).
  sort_top3 as (
    select t.user_id, sum(case t.tier when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'C' then 1 else 0 end) as score
    from public.top3_tiers_set(array(select l.id from listed l), (select id from me), line_count) t
    where sort = 'top3'
    group by t.user_id
  ),
  ranked as (
    select l.*,
      row_number() over (
        order by
          case when sort = 'active' then l.last_seen_at end desc nulls last,
          case when sort = 'you_fit' then l.you_pct end desc nulls last,
          case when sort = 'they_fit' then l.they_pct end desc nulls last,
          -- Your Top 3 by the tier each sits in on their Tier List (S 4 .. C 1, Avoid 0); all dashes: last.
          case when sort = 'top3' then st.score end desc nulls last,
          l.both_pct desc nulls last,
          cardinality(l.you_wants) desc,
          l.last_seen_at desc,
          l.id
      ) as rn,
      count(*) over () as total
    from listed l
    left join sort_top3 st on st.user_id = l.id
  ),
  page as (
    select r.* from ranked r
    where r.rn > greatest(page_offset, 0)
      and r.rn <= greatest(page_offset, 0) + least(greatest(page_size, 1), 50)
  ),
  -- For the cards, whatever the sort: line -> tier, for this page only.
  page_top3 as (
    select t.user_id, jsonb_object_agg(t.line_id, t.tier) as tiers
    from public.top3_tiers_set(array(select p.id from page p), (select id from me), line_count) t
    group by t.user_id
  )
  select
    l.id,
    case when public.shows_discord(l.id, l.show_discord) then l.discord_username end,
    case when public.shows_discord(l.id, l.show_discord) then l.discord_display_name end,
    case when public.shows_discord(l.id, l.show_discord) then l.avatar_url end,
    l.ign,
    case when l.code_visibility = 'matches' then l.friend_code end,
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
    pt.tiers,
    l.total
  from page l
  left join page_top3 pt on pt.user_id = l.id
  order by l.rn
$$;

create or replace function public.browse_all()
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
      -- Strangers only see an IGN, so no IGN: not suggested.
      and pr.ign is not null
      -- Not findable by search: not suggested either.
      and pr.allow_lookup
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
    join public.profiles fp on fp.id = f.friend_id
    where f.friend_id <> (select id from me)
      and exists (select 1 from public.preferences p where p.user_id = f.friend_id and p.choice = 'want')
    group by f.user_id
  ),
  -- Each candidate's friends' wants (their Tier List), leaving you out. Read once.
  friend_votes as materialized (
    select f.user_id as cand, f.friend_id, p.line_id
    from public.friends f
    join friend_voters v on v.cand = f.user_id and v.voters >= 3
    join public.profiles fp on fp.id = f.friend_id
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
    case when public.shows_discord(s.id, s.show_discord) then s.discord_username end,
    case when public.shows_discord(s.id, s.show_discord) then s.discord_display_name end,
    case when public.shows_discord(s.id, s.show_discord) then s.avatar_url end,
    s.ign,
    case when s.code_visibility = 'matches' then s.friend_code end,
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
    case when public.shows_discord(s.id, s.show_reddit) then s.reddit_username end,
    not public.shows_votes(s.id)
  from combined s, cfg
  -- Best match order, so a capped list keeps the best.
  order by s.both_pct desc nulls last, cardinality(s.you_wants) desc, s.last_seen_at desc, s.id
  limit 1000
$$;

alter table public.profiles drop column if exists share_code;
