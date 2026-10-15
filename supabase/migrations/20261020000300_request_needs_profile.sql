-- Sending a friend request needs your IGN and friend code set, so the other
-- player can tell who's asking (no more "Unknown player" requests) and find
-- you in Pokémon Sleep. Accepting a request, or sending one back to someone
-- who already asked you (the same thing), still works without them.
-- Safe to re-run.

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
  if not exists (select 1 from public.profiles where id = target and allow_lookup) then
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

  -- They already asked you: that's a yes from both sides.
  if exists (
    select 1 from public.friend_requests
    where from_id = target and to_id = me and status = 'open' and created_at > now() - public.request_ttl()
  ) then
    perform public.make_friends(me, target);
    return 'friends';
  end if;

  -- Asking someone new needs a way to recognize you, here and in the game: an
  -- IGN and a friend code. (Answering their request above doesn't.)
  if exists (select 1 from public.profiles where id = me and (ign is null or friend_code is null)) then
    raise exception 'profile_incomplete';
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
revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
