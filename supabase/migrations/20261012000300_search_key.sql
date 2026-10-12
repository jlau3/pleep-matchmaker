-- Friend search ignores more than letter case.
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
