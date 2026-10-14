-- Pending friends: players you've sent a request to in Pokémon Sleep but
-- haven't added here yet. Find New's Add friend marks one pending; once
-- they accept in the game you add them for real (which clears it), or cancel.
-- Only you see your own. Safe to re-run.

create table if not exists public.pending_friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  check (user_id <> target_id)
);

alter table public.pending_friends enable row level security;

revoke all on public.pending_friends from anon, authenticated;
grant select, insert, delete on public.pending_friends to authenticated;

drop policy if exists "own pending read" on public.pending_friends;
create policy "own pending read" on public.pending_friends
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own pending insert" on public.pending_friends;
create policy "own pending insert" on public.pending_friends
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own pending delete" on public.pending_friends;
create policy "own pending delete" on public.pending_friends
  for delete to authenticated using (user_id = (select auth.uid()));

-- Adding them as a friend, or a block either way, settles a pending request.
create or replace function public.clear_pending_friend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'friends' then
    delete from public.pending_friends where user_id = new.user_id and target_id = new.friend_id;
  else
    delete from public.pending_friends
    where (user_id = new.blocker_id and target_id = new.blocked_id)
       or (user_id = new.blocked_id and target_id = new.blocker_id);
  end if;
  return new;
end
$$;

drop trigger if exists friends_clear_pending on public.friends;
create trigger friends_clear_pending after insert on public.friends
  for each row execute function public.clear_pending_friend();
drop trigger if exists blocks_clear_pending on public.blocks;
create trigger blocks_clear_pending after insert on public.blocks
  for each row execute function public.clear_pending_friend();

-- Your pending players for My Friends, newest first, names masked like everywhere else.
create or replace function public.get_pending_friends()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  pending_since timestamptz
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
    pf.created_at
  from public.pending_friends pf
  join public.profiles pr on pr.id = pf.target_id
  where pf.user_id = auth.uid()
    and not exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = pf.target_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = pf.target_id)
         or (b.blocker_id = pf.target_id and b.blocked_id = auth.uid())
    )
  order by pf.created_at desc
$$;

revoke execute on function public.get_pending_friends() from public, anon;
grant execute on function public.get_pending_friends() to authenticated;
