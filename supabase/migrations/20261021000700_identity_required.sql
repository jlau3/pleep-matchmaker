-- IGN and friend code are your identity for everything social: searching
-- for players now needs both (was IGN only, 20261021000300), and so does
-- accepting a friend request, including by asking back (sending already
-- did, 20261020000300).
-- Declining still works without them. Safe to re-run.

create or replace function public.accept_friend_request(requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.friend_requests
    where from_id = requester and to_id = me and status = 'open' and created_at > now() - public.request_ttl()
  ) then
    raise exception 'request_gone';
  end if;
  -- Your new friend needs to recognize you and add you in the game.
  if exists (select 1 from public.profiles where id = me and (ign is null or friend_code is null)) then
    raise exception 'profile_incomplete';
  end if;
  if (select count(*) from public.friends where user_id = me) >= public.max_friends() then
    raise exception 'friend_limit';
  end if;
  perform public.make_friends(me, requester);
end;
$$;

create or replace function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or target is null or target = me then
    raise exception 'friend_unavailable';
  end if;
  if exists (select 1 from public.friends where user_id = me and friend_id = target) then
    return 'friends';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'friend_unavailable';
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = target) or (b.blocker_id = target and b.blocked_id = me)
  ) then
    raise exception 'friend_unavailable';
  end if;
  if (select count(*) from public.friends where user_id = me) >= public.max_friends() then
    raise exception 'friend_limit';
  end if;

  -- Asking anyone, or answering their request by asking back, needs a way to
  -- recognize you here and in the game: an IGN and a friend code.
  if exists (select 1 from public.profiles where id = me and (ign is null or friend_code is null)) then
    raise exception 'profile_incomplete';
  end if;

  -- They already asked you: that's a yes from both sides.
  if exists (
    select 1 from public.friend_requests
    where from_id = target and to_id = me and status = 'open' and created_at > now() - public.request_ttl()
  ) then
    perform public.make_friends(me, target);
    return 'friends';
  end if;

  -- One open request per friend slot keeps this from being used to spam.
  if (
    select count(*) from public.friend_requests
    where from_id = me and status = 'open' and created_at > now() - public.request_ttl()
  ) >= public.max_friends() then
    raise exception 'request_limit';
  end if;

  insert into public.friend_requests (from_id, to_id) values (me, target)
  on conflict (from_id, to_id) do update
    set status = 'open', created_at = now(), responded_at = null;
  return 'sent';
end;
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
    -- Closed to new friends: the code shows only to someone who typed it, to
    -- friends (either way round), and to themselves.
    case when (h.open_to_friends and h.share_code) or h.code_hit or h.id = auth.uid()
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
