-- Fuzzy name search: IGNs and (shown) Discord names now match with typos and
-- partial names ("snorlax" finds "Snorlax Fan"), not just exactly. To keep it
-- from becoming a directory: fuzzy needs 3+ characters, a close score
-- (fuzzy_name_min), and returns at most 10 players, best first. Exact matches
-- still work from 2 characters, friend codes stay exact, and allow_lookup,
-- hidden Discord names and blocks apply as before. Uses pg_trgm (Supabase:
-- Database -> Extensions; created here in the extensions schema). Safe to re-run.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- How close a fuzzy name match has to be (pg_trgm word similarity, 0..1).
create or replace function public.fuzzy_name_min()
returns numeric
language sql
immutable
as $$ select 0.5 $$;

-- 1 for an exact (normalized) match, else how well the query matches part of the name.
create or replace function public.name_match(name text, q text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when name is null or q is null or q = '' then null
    when public.search_key(name) = q then 1
    else extensions.word_similarity(q, public.search_key(name))::numeric
  end
$$;

drop function if exists public.lookup_players(text);

create function public.lookup_players(q text)
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
      ) as score
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
    h.friend_code,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.top), '{}'),
    case when h.id <> auth.uid() then public.fit_pct(auth.uid(), h.id) end,
    case when h.id <> auth.uid() then public.you_fit_pct(auth.uid(), h.id) end
  from hits h
  order by h.score desc, h.last_seen_at desc
$$;


revoke execute on function public.lookup_players(text) from public, anon;
grant execute on function public.lookup_players(text) to authenticated;
