-- One-letter names: a player called "M" couldn't be found, because search
-- ignored anything under 2 characters. Exact names now match at any length;
-- partial and typo matches still need 3+ characters, so searching "M" finds
-- only players named exactly M (not Mo, Molli or Mah). lookup_players as in
-- profile_extras, with that one change. Safe to re-run.

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
      and n.text_q <> ''
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
