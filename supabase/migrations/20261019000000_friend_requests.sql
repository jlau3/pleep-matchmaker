-- Friend requests: a handshake instead of one-way adds. Sending a request
-- (which also means "I'll send you one in Pokémon Sleep") puts nobody on
-- anyone's list; when the other player accepts, both of you are on each
-- other's list. Declines are shown to the sender, who can clear them and ask
-- again. Open requests lapse after 30 days. Requests that cross (you each ask
-- the other) count as accepted.
--
-- Friendships are now only written by these functions: players can no longer
-- insert into public.friends directly. Removing a friend still removes both
-- directions (friends_unfriend_both_ways).
--
-- Existing data: mutual pairs stay friends. Each one-way add becomes a
-- request from the adder; a "Not now" on it becomes a decline. "Pending in
-- Pokémon Sleep" entries become requests (or friendships, where both sides
-- had asked). The old one-way pieces (pending_friends, "Added you" and its
-- dismissals) are dropped.
--
-- Run it right after deploying the app that uses it. Safe to re-run.

create table if not exists public.friend_requests (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_id);

alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;
-- Read-only for players (both ends of a request); every change goes through the functions below.
grant select on public.friend_requests to authenticated;
drop policy if exists "own requests read" on public.friend_requests;
create policy "own requests read" on public.friend_requests
  for select to authenticated using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

-- How long an unanswered request stays open.
create or replace function public.request_ttl()
returns interval
language sql
immutable
as $$ select interval '30 days' $$;

-- No more direct adds: the handshake is the only way onto a list.
revoke insert on public.friends from authenticated;
drop policy if exists "own friends insert" on public.friends;

-- The adder no longer needs the other player findable: accepting is their consent.
-- The cap and blocks still apply.
create or replace function public.check_friend_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize adds per user so concurrent inserts can't overshoot the cap.
  perform 1 from public.profiles where id = new.user_id for update;

  if (select count(*) from public.friends where user_id = new.user_id) >= public.max_friends() then
    raise exception 'friend_limit' using hint = format('You can have up to %s friends', public.max_friends());
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = new.friend_id)
       or (b.blocker_id = new.friend_id and b.blocked_id = new.user_id)
  ) then
    raise exception 'friend_unavailable';
  end if;
  return new;
end;
$$;

-- Both rows of a friendship, and the request between them gone.
create or replace function public.make_friends(a uuid, b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.friends where user_id = b) >= public.max_friends()
     and not exists (select 1 from public.friends where user_id = b and friend_id = a) then
    raise exception 'their_list_full';
  end if;
  insert into public.friends (user_id, friend_id) values (a, b) on conflict do nothing;
  insert into public.friends (user_id, friend_id) values (b, a) on conflict do nothing;
  delete from public.friend_requests where (from_id = a and to_id = b) or (from_id = b and to_id = a);
end;
$$;
revoke execute on function public.make_friends(uuid, uuid) from public, anon, authenticated;

-- Send a request. Returns 'sent', or 'friends' when they had already asked you.
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
  if (select count(*) from public.friends where user_id = me) >= public.max_friends() then
    raise exception 'friend_limit';
  end if;
  perform public.make_friends(me, requester);
end;
$$;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.decline_friend_request(requester uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.friend_requests
  set status = 'declined', responded_at = now()
  where from_id = requester and to_id = auth.uid() and status = 'open'
$$;
revoke execute on function public.decline_friend_request(uuid) from public, anon;
grant execute on function public.decline_friend_request(uuid) to authenticated;

-- Withdraw your request, or clear a decline (you can ask again after).
create or replace function public.cancel_friend_request(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friend_requests where from_id = auth.uid() and to_id = target
$$;
revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- A block drops requests either way.
create or replace function public.clear_requests_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_requests
  where (from_id = new.blocker_id and to_id = new.blocked_id)
     or (from_id = new.blocked_id and to_id = new.blocker_id);
  return new;
end;
$$;
drop trigger if exists blocks_clear_requests on public.blocks;
create trigger blocks_clear_requests after insert on public.blocks
  for each row execute function public.clear_requests_on_block();

-- Requests to you, newest first. The sender's friend code always shows: they
-- asked, so you can send the in-game request yourself.
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
    pr.friend_code,
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
revoke execute on function public.get_friend_requests(boolean) from public, anon;
grant execute on function public.get_friend_requests(boolean) to authenticated;

-- Your requests, newest first: still open (not lapsed) or declined. Their
-- friend code shows only if they're open to new friends (as in search).
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
    case when pr.open_to_friends then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    r.created_at,
    r.status
  from public.friend_requests r
  join public.profiles pr on pr.id = r.to_id
  where r.from_id = auth.uid()
    and (r.status = 'declined' or r.created_at > now() - public.request_ttl())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.to_id)
         or (b.blocker_id = r.to_id and b.blocked_id = auth.uid())
    )
  order by r.created_at desc
$$;
revoke execute on function public.get_sent_requests() from public, anon;
grant execute on function public.get_sent_requests() to authenticated;

-- Existing data, once (the old tables are dropped right after).
do $$
begin
  if to_regclass('public.pending_friends') is not null then
    -- Both had asked each other: friends.
    insert into public.friends (user_id, friend_id)
    select p.user_id, p.target_id from public.pending_friends p
    join public.pending_friends q on q.user_id = p.target_id and q.target_id = p.user_id
    on conflict do nothing;
    -- Otherwise a request (unless they're friends already, either way).
    insert into public.friend_requests (from_id, to_id, created_at)
    select p.user_id, p.target_id, p.created_at from public.pending_friends p
    where not exists (select 1 from public.friends f where f.user_id = p.user_id and f.friend_id = p.target_id)
      and not exists (select 1 from public.friends f where f.user_id = p.target_id and f.friend_id = p.user_id)
    on conflict do nothing;
  end if;

  -- One-way adds become requests from the adder, created when they added.
  insert into public.friend_requests (from_id, to_id, created_at)
  select f.user_id, f.friend_id, f.created_at from public.friends f
  where not exists (select 1 from public.friends back where back.user_id = f.friend_id and back.friend_id = f.user_id)
  on conflict (from_id, to_id) do update set created_at = least(public.friend_requests.created_at, excluded.created_at);
  -- An old add shouldn't lapse the day this ships: give every request the full window from now.
  update public.friend_requests set created_at = now() where status = 'open' and created_at < now() - public.request_ttl();

  if to_regclass('public.friend_prompt_dismissals') is not null then
    update public.friend_requests r
    set status = 'declined', responded_at = d.created_at
    from public.friend_prompt_dismissals d
    where r.from_id = d.adder_id and r.to_id = d.user_id;
  end if;

  delete from public.friends f
  where not exists (select 1 from public.friends back where back.user_id = f.friend_id and back.friend_id = f.user_id);
end
$$;

-- The one-way pieces.
drop trigger if exists friends_accept_pending on public.friends;
drop function if exists public.accept_pending_friend();
drop trigger if exists friends_clear_pending on public.friends;
drop trigger if exists blocks_clear_pending on public.blocks;
drop function if exists public.clear_pending_friend();
drop function if exists public.get_pending_friends();
drop table if exists public.pending_friends;
drop function if exists public.get_added_me(boolean);
drop function if exists public.get_added_me();
drop table if exists public.friend_prompt_dismissals;
