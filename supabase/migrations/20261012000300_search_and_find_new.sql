-- 1. Friend search ignores more than letter case.
--
-- search_key folds a name to: Unicode NFKC (full-width "ＳＮＯＲＬＡＸ" -> "SNORLAX",
-- composed vs decomposed accents agree), lower case, trimmed, and runs of
-- whitespace collapsed to one space. lookup_players compares keys on both
-- sides. Still exact-match only: no partial matches, so the player list
-- can't be enumerated.

create function public.search_key(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(btrim(normalize(t, NFKC)), '\s+', ' ', 'g'))
$$;

create index profiles_discord_username_key_idx on public.profiles (public.search_key(discord_username));
create index profiles_discord_display_name_key_idx on public.profiles (public.search_key(discord_display_name));
create index profiles_ign_key_idx on public.profiles (public.search_key(ign));

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
  top_wants text[]
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
              where p.user_id = h.id and p.top), '{}')
  from hits h
  order by h.last_seen_at desc
$$;

-- 2. Find New leaves out players the caller already added as a friend.
-- Same as the top3 version apart from the friends check in candidates.

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
  shared_wants text[],
  shared_dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  mine as (
    select p.line_id, p.choice, p.top
    from public.preferences p
    where p.user_id = (select id from me) and p.choice <> 'undecided'
  ),
  candidates as (
    select pr.*
    from public.profiles pr, cfg
    where pr.id <> (select id from me)
      and pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and (select count(*) from public.friends f where f.user_id = pr.id) < public.max_friends()
      -- Find New is for new people: skip anyone the caller already added.
      and not exists (select 1 from public.friends f where f.user_id = (select id from me) and f.friend_id = pr.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
  ),
  theirs as (
    select p.user_id, p.line_id, p.choice, p.top
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice <> 'undecided'
  ),
  pair_lines as (
    select c.id as other_id, m.line_id from candidates c cross join mine m
    union
    select t.user_id, t.line_id from theirs t
  ),
  scored as (
    select pl.other_id, pl.line_id, m.choice as a, t.choice as b,
           -- A line either side starred counts top_multiplier() times over.
           case when coalesce(m.top, false) or coalesce(t.top, false) then public.top_multiplier() else 1 end as mult
    from pair_lines pl
    left join mine m on m.line_id = pl.line_id
    left join theirs t on t.user_id = pl.other_id and t.line_id = pl.line_id
  ),
  agg as (
    select
      s.other_id,
      sum(s.mult * case
            when s.a = 'want' and s.b = 'want' then cfg.w_both_want
            when s.a = 'dont_want' and s.b = 'dont_want' then cfg.w_both_dont
            when (s.a = 'want' and s.b = 'dont_want') or (s.a = 'dont_want' and s.b = 'want') then cfg.w_conflict
            else 0
          end) as score,
      sum(s.mult * case when s.a = 'want' or s.b = 'want' then cfg.w_both_want else cfg.w_both_dont end) as best,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'want' and s.b = 'want'), '{}') as shared_wants,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'dont_want' and s.b = 'dont_want'), '{}') as shared_dont_wants
    from scored s, cfg
    group by s.other_id
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
    round(100.0 * greatest(a.score, 0) / a.best)::int as match_pct,
    a.shared_wants,
    a.shared_dont_wants
  from agg a
  join candidates c on c.id = a.other_id
  cross join cfg
  where cardinality(a.shared_wants) >= cfg.min_shared_wants
    and 100.0 * greatest(a.score, 0) / a.best >= cfg.min_pct
  order by match_pct desc, cardinality(a.shared_wants) desc, c.last_seen_at desc
  limit 100
$$;
