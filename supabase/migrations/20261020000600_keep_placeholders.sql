-- Not here yet names stay until you remove them. Becoming friends with
-- someone whose IGN matches a name no longer deletes it by itself (IGNs
-- aren't unique, so it may not be the friend you meant): the app asks when
-- you accept or send a request from that name, and get_friend_placeholders
-- now says when a friend of yours has that name (friend), so the list can
-- offer to clear it. Safe to re-run.

drop trigger if exists friends_clear_placeholder on public.friends;
drop function if exists public.clear_friend_placeholder();

-- A new column, so drop and create.
drop function if exists public.get_friend_placeholders();

create function public.get_friend_placeholders()
returns table (name text, created_at timestamptz, signed_up boolean, friend boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fp.name,
    fp.created_at,
    -- A player with the same IGN (strong_name_key) can be found here (lookup's rules: allow_lookup, no blocks).
    exists (
      select 1 from public.profiles pr
      where pr.allow_lookup
        and pr.id <> auth.uid()
        and public.strong_name_key(pr.ign) = public.strong_name_key(fp.name)
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
             or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
        )
    ),
    -- One of your friends has that IGN.
    exists (
      select 1 from public.friends f
      join public.profiles pr on pr.id = f.friend_id
      where f.user_id = auth.uid()
        and public.strong_name_key(pr.ign) = public.strong_name_key(fp.name)
    )
  from public.friend_placeholders fp
  where fp.user_id = auth.uid()
  order by fp.created_at
$$;
revoke execute on function public.get_friend_placeholders() from public, anon;
grant execute on function public.get_friend_placeholders() to authenticated;
