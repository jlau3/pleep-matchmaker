-- Friends list: a one-way list of up to max_friends() players per user, used
-- for the "what do my friends want" dashboard. Visibility follows lookup
-- rules: a friend who turns off allow_lookup, or a block in either direction,
-- hides their picks.

create table public.friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friends_friend_idx on public.friends (friend_id);

alter table public.friends enable row level security;

create policy "own friends read" on public.friends
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own friends insert" on public.friends
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own friends delete" on public.friends
  for delete to authenticated using (user_id = (select auth.uid()));

create function public.max_friends()
returns int
language sql
immutable
as $$ select 50 $$;

create function public.check_friend_insert()
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
  if not exists (select 1 from public.profiles where id = new.friend_id and allow_lookup) then
    raise exception 'friend_unavailable';
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

create trigger on_friend_insert
  before insert on public.friends
  for each row execute function public.check_friend_insert();

-- Blocking someone drops them from both friend lists.
create function public.unfriend_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friends
  where (user_id = new.blocker_id and friend_id = new.blocked_id)
     or (user_id = new.blocked_id and friend_id = new.blocker_id);
  return new;
end;
$$;

create trigger on_block_insert
  after insert on public.blocks
  for each row execute function public.unfriend_on_block();

-- The caller's friends with their picks. visible = false means the friend
-- turned off lookup; only their names come back.
create function public.get_friends()
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
  dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    pr.discord_username,
    pr.discord_display_name,
    pr.avatar_url,
    case when pr.allow_lookup then pr.ign end,
    case when pr.allow_lookup then pr.friend_code end,
    pr.last_seen_at,
    pr.prefs_updated_at,
    f.created_at,
    pr.allow_lookup,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

revoke execute on function public.get_friends() from public, anon;
grant execute on function public.get_friends() to authenticated;
