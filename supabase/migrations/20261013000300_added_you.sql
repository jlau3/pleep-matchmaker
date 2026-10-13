-- "Added you": friend lists stay one-way (the game itself only has mutual
-- friendships, so a one-sided list here just means someone hasn't added the
-- other in the app yet). Players now see who added them and can add them back
-- or dismiss the prompt, and My Friends marks friends who added you too.
-- Safe to re-run.

create table if not exists public.friend_prompt_dismissals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  adder_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, adder_id)
);

alter table public.friend_prompt_dismissals enable row level security;
revoke all on public.friend_prompt_dismissals from anon, authenticated;
grant select, insert, delete on public.friend_prompt_dismissals to authenticated;

drop policy if exists "own dismissals read" on public.friend_prompt_dismissals;
create policy "own dismissals read" on public.friend_prompt_dismissals
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own dismissals insert" on public.friend_prompt_dismissals;
create policy "own dismissals insert" on public.friend_prompt_dismissals
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own dismissals delete" on public.friend_prompt_dismissals;
create policy "own dismissals delete" on public.friend_prompt_dismissals
  for delete to authenticated using (user_id = (select auth.uid()));

-- Players who added you and you haven't added back or dismissed, newest
-- first. Only players you could add (lookup on, no block either way); names
-- masked like everywhere else.
create or replace function public.get_added_me()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  added_at timestamptz
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
    f.created_at
  from public.friends f
  join public.profiles pr on pr.id = f.user_id
  where f.friend_id = auth.uid()
    and pr.allow_lookup
    and not exists (select 1 from public.friends mine where mine.user_id = auth.uid() and mine.friend_id = f.user_id)
    and not exists (select 1 from public.friend_prompt_dismissals d where d.user_id = auth.uid() and d.adder_id = f.user_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = f.user_id)
         or (b.blocker_id = f.user_id and b.blocked_id = auth.uid())
    )
  order by f.created_at desc
$$;

revoke execute on function public.get_added_me() from public, anon;
grant execute on function public.get_added_me() to authenticated;


-- get_friends gains added_me: whether that friend has you on their list too.
drop function if exists public.get_friends(boolean);

create function public.get_friends(with_match boolean default true)
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
  dont_wants text[],
  top_wants text[],
  match_pct int,
  added_me boolean
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
      where p.user_id = pr.id and p.choice = 'dont_want'), '{}') else '{}' end,
    case when pr.allow_lookup then coalesce((
      select array_agg(p.line_id order by p.line_id) from public.preferences p
      where p.user_id = pr.id and p.top), '{}') else '{}' end,
    case when with_match and pr.allow_lookup then public.fit_pct(auth.uid(), pr.id) end,
    exists (select 1 from public.friends back where back.user_id = pr.id and back.friend_id = auth.uid())
  from public.friends f
  join public.profiles pr on pr.id = f.friend_id
  where f.user_id = auth.uid()
  order by f.created_at
$$;

revoke execute on function public.get_friends(boolean) from public, anon;
grant execute on function public.get_friends(boolean) to authenticated;
