-- Pleep Matchmaker schema.
--
-- Privacy model: authenticated users can read and write only their own rows.
-- Everything about other players (match results, lookups, community stats)
-- goes through the security definer functions at the bottom, which apply
-- visibility rules (blocks, staleness, open_to_friends, allow_lookup).

create type public.choice as enum ('want', 'dont_want', 'undecided');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text check (char_length(ign) between 1 and 40),
  friend_code text check (friend_code ~ '^[0-9]{12}$'),
  open_to_friends boolean not null default true,
  allow_lookup boolean not null default true,
  last_seen_at timestamptz not null default now(),
  prefs_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_discord_username_idx on public.profiles (lower(discord_username));
create index profiles_discord_display_name_idx on public.profiles (lower(discord_display_name));
create index profiles_ign_idx on public.profiles (lower(ign));
create index profiles_friend_code_idx on public.profiles (friend_code);

create table public.preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  line_id text not null check (char_length(line_id) <= 64),
  choice public.choice not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, line_id)
);

create index preferences_line_choice_idx on public.preferences (line_id, choice);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Row level security: own rows only.

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.blocks enable row level security;

create policy "own profile read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Explicit grants, so this works whether or not the project auto-exposes new
-- tables. anon gets nothing; RLS narrows authenticated to its own rows.
revoke all on public.profiles, public.preferences, public.blocks from anon, authenticated;
grant select on public.profiles to authenticated;
-- Discord fields and timestamps are maintained by triggers, not the client.
grant update (ign, friend_code, open_to_friends, allow_lookup) on public.profiles to authenticated;
grant select, insert, update, delete on public.preferences to authenticated;
grant select, insert, delete on public.blocks to authenticated;

create policy "own prefs read" on public.preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own prefs insert" on public.preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own prefs update" on public.preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own prefs delete" on public.preferences
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "own blocks read" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "own blocks insert" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "own blocks delete" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Profile sync from Discord OAuth metadata, on signup and on every login.

create function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, discord_id, discord_username, discord_display_name, avatar_url)
  values (
    new.id,
    meta ->> 'provider_id',
    split_part(coalesce(meta ->> 'name', meta ->> 'full_name', ''), '#', 1),
    coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name'),
    meta ->> 'avatar_url'
  )
  on conflict (id) do update set
    discord_id = excluded.discord_id,
    discord_username = excluded.discord_username,
    discord_display_name = excluded.discord_display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- prefs_updated_at moves only when a choice really changes.

create function public.touch_prefs_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.choice = new.choice then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  update public.profiles set prefs_updated_at = now() where id = new.user_id;
  return new;
end;
$$;

create trigger on_preference_written
  before insert or update on public.preferences
  for each row execute function public.touch_prefs_updated();

-- Tuning knobs for matching and visibility. Change them here and re-run this
-- function definition; nothing else needs to move.

create function public.match_config()
returns table (
  w_both_want int,
  w_both_dont int,
  w_conflict int,
  min_pct numeric,
  min_shared_wants int,
  stale_after interval
)
language sql
immutable
as $$
  select 3, 1, -3, 25.0, 3, interval '4 months'
$$;

-- Called from middleware on logged-in requests; throttled to one write per 5 min.

create function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid() and last_seen_at < now() - interval '5 minutes';
$$;

-- Scores the caller against every visible player.
--
-- Per candy line, with A = caller and B = other:
--   both want      +w_both_want
--   both dont      +w_both_dont
--   want vs dont   +w_conflict (negative)
--   anything with undecided/unpicked on one side: 0
-- Lines count only when at least one side picked want or dont_want. Each such
-- line's best case is w_both_want if either side wants it, else w_both_dont.
-- match % = max(0, score) / sum(best case). Want vs undecided therefore
-- costs a match via the denominator alone; want vs dont costs it twice.

create function public.get_matches()
returns table (
  user_id uuid,
  discord_username text,
  discord_display_name text,
  avatar_url text,
  ign text,
  friend_code text,
  last_seen_at timestamptz,
  prefs_updated_at timestamptz,
  match_pct int,
  shared_wants text[],
  shared_dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  cfg as (select * from public.match_config()),
  me as (select auth.uid() as id),
  mine as (
    select p.line_id, p.choice
    from public.preferences p
    where p.user_id = (select id from me) and p.choice <> 'undecided'
  ),
  candidates as (
    select pr.*
    from public.profiles pr, cfg
    where pr.id <> (select id from me)
      and pr.open_to_friends
      and pr.friend_code is not null
      and pr.last_seen_at > now() - cfg.stale_after
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select id from me) and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = (select id from me))
      )
  ),
  theirs as (
    select p.user_id, p.line_id, p.choice
    from public.preferences p
    join candidates c on c.id = p.user_id
    where p.choice <> 'undecided'
  ),
  pair_lines as (
    select c.id as other_id, m.line_id from candidates c cross join mine m
    union
    select t.user_id, t.line_id from theirs t
  ),
  scored as (
    select pl.other_id, pl.line_id, m.choice as a, t.choice as b
    from pair_lines pl
    left join mine m on m.line_id = pl.line_id
    left join theirs t on t.user_id = pl.other_id and t.line_id = pl.line_id
  ),
  agg as (
    select
      s.other_id,
      sum(case
            when s.a = 'want' and s.b = 'want' then cfg.w_both_want
            when s.a = 'dont_want' and s.b = 'dont_want' then cfg.w_both_dont
            when (s.a = 'want' and s.b = 'dont_want') or (s.a = 'dont_want' and s.b = 'want') then cfg.w_conflict
            else 0
          end) as score,
      sum(case when s.a = 'want' or s.b = 'want' then cfg.w_both_want else cfg.w_both_dont end) as best,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'want' and s.b = 'want'), '{}') as shared_wants,
      coalesce(array_agg(s.line_id order by s.line_id) filter (where s.a = 'dont_want' and s.b = 'dont_want'), '{}') as shared_dont_wants
    from scored s, cfg
    group by s.other_id
  )
  select
    c.id,
    c.discord_username,
    c.discord_display_name,
    c.avatar_url,
    c.ign,
    c.friend_code,
    c.last_seen_at,
    c.prefs_updated_at,
    round(100.0 * greatest(a.score, 0) / a.best)::int as match_pct,
    a.shared_wants,
    a.shared_dont_wants
  from agg a
  join candidates c on c.id = a.other_id
  cross join cfg
  where cardinality(a.shared_wants) >= cfg.min_shared_wants
    and 100.0 * greatest(a.score, 0) / a.best >= cfg.min_pct
  order by match_pct desc, cardinality(a.shared_wants) desc, c.last_seen_at desc
  limit 100
$$;

-- Look up a specific player by exact Discord username, display name, IGN or
-- friend code (case-insensitive, no partial matches, so the player list can't
-- be enumerated). Players who turned off allow_lookup never appear.

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
  dont_wants text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  needle as (
    select
      lower(trim(both '@ ' from q)) as text_q,
      nullif(regexp_replace(q, '[^0-9]', '', 'g'), '') as digits_q
  ),
  hits as (
    select pr.*
    from public.profiles pr, needle n
    where pr.allow_lookup
      and char_length(n.text_q) >= 2
      and (
        lower(pr.discord_username) = n.text_q
        or lower(pr.discord_display_name) = n.text_q
        or lower(pr.ign) = n.text_q
        or (char_length(n.digits_q) = 12 and pr.friend_code = n.digits_q)
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
           or (b.blocker_id = pr.id and b.blocked_id = auth.uid())
      )
    limit 20
  )
  select
    h.id,
    h.discord_username,
    h.discord_display_name,
    h.avatar_url,
    h.ign,
    h.friend_code,
    h.last_seen_at,
    h.prefs_updated_at,
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'want'), '{}'),
    coalesce((select array_agg(p.line_id order by p.line_id) from public.preferences p
              where p.user_id = h.id and p.choice = 'dont_want'), '{}')
  from hits h
  order by h.last_seen_at desc
$$;

-- Community vote counts per line among active players. Aggregates only.

create function public.get_line_stats()
returns table (line_id text, wants bigint, dont_wants bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.line_id,
         count(*) filter (where p.choice = 'want'),
         count(*) filter (where p.choice = 'dont_want')
  from public.preferences p
  join public.profiles pr on pr.id = p.user_id
  cross join public.match_config() cfg
  where pr.last_seen_at > now() - cfg.stale_after
  group by p.line_id
$$;

create function public.get_blocked()
returns table (user_id uuid, discord_username text, discord_display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.discord_username, pr.discord_display_name, b.created_at
  from public.blocks b
  join public.profiles pr on pr.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

-- Deleting the auth user cascades to profile, preferences and blocks.

create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function
  public.touch_last_seen(),
  public.get_matches(),
  public.lookup_players(text),
  public.get_line_stats(),
  public.get_blocked(),
  public.delete_my_account()
from public, anon;

grant execute on function
  public.touch_last_seen(),
  public.get_matches(),
  public.lookup_players(text),
  public.get_line_stats(),
  public.get_blocked(),
  public.delete_my_account()
to authenticated;
