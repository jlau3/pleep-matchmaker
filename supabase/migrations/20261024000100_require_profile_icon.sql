-- All three saved identity fields are required before using social features.
create or replace function public.social_profile_ready(player uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = player
    and nullif(btrim(p.ign), '') is not null and p.friend_code is not null
    and p.game_avatar is not null)
$$;
revoke all on function public.social_profile_ready(uuid) from public, anon;
grant execute on function public.social_profile_ready(uuid) to authenticated;

create or replace function public.send_friend_request(target uuid, with_code boolean default true)
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
  if not public.social_profile_ready(me) then
    raise exception 'profile_incomplete';
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
  if not public.social_profile_ready(me) then
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

  insert into public.friend_requests (from_id, to_id, share_code) values (me, target, coalesce(with_code, true))
  on conflict (from_id, to_id) do update
    set status = 'open', created_at = now(), responded_at = null, share_code = excluded.share_code;
  return 'sent';
end;
$$;
revoke execute on function public.send_friend_request(uuid, boolean) from public, anon;
grant execute on function public.send_friend_request(uuid, boolean) to authenticated;


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
  if not public.social_profile_ready(me) then
    raise exception 'profile_incomplete';
  end if;
  if (select count(*) from public.friends where user_id = me) >= public.max_friends() then
    raise exception 'friend_limit';
  end if;
  perform public.make_friends(me, requester);
end;
$$;


-- Preserve each existing query and its privacy rules while adding the same
-- identity check to search and both candidate loaders. Fail if their expected
-- query shapes changed, rather than silently leaving an endpoint ungated.
do $migration$
declare definition text; signature text;
begin
  foreach signature in array array['public.lookup_players(text)', 'public.browse_all()', 'public.browse_players(text,boolean,integer,integer,integer)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if position('public.social_profile_ready' in definition) > 0 then continue; end if;
    if signature = 'public.lookup_players(text)' then
      if position('where pr.allow_lookup' in definition) = 0 then raise exception 'lookup shape changed'; end if;
      definition := replace(definition, 'where pr.allow_lookup',
        'where pr.allow_lookup and public.social_profile_ready(auth.uid())');
    else
      if position('where pr.id <>' in definition) = 0 then raise exception 'browse shape changed: %', signature; end if;
      definition := replace(definition, 'where pr.id <>',
        'where public.social_profile_ready(auth.uid()) and public.social_profile_ready(pr.id) and pr.id <>');
    end if;
    execute definition;
  end loop;
end
$migration$;
