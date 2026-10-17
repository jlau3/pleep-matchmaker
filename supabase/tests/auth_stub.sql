-- Minimal stand-in for the Supabase auth schema and roles, so migrations and
-- tests run against plain Postgres. Not loaded in real Supabase projects.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb
);
-- One row per sign-in method on an account (Discord, Google, ...).
create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase's default privileges: API roles get full table access and execute
-- on new functions; migrations narrow this with RLS and explicit revokes.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

-- Test fixtures only: a mutual friendship written directly, the end state of
-- a request and accept (players can't insert into public.friends). plpgsql,
-- so the table only has to exist when it's called.
create function public.test_befriend(a uuid, b uuid) returns void
language plpgsql security definer
as $$
begin
  insert into public.friends (user_id, friend_id) values (a, b), (b, a) on conflict do nothing;
end
$$;

-- Test fixtures only: an IGN and friend code for every player whose id starts
-- with id_prefix and lacks one, so they can send friend requests
-- (20261020000300_request_needs_profile.sql). Existing values are kept.
create function public.test_complete_profiles(id_prefix text) returns void
language plpgsql security definer
as $$
begin
  update public.profiles
  set ign = coalesce(ign, 'tester' || right(id::text, 4)),
      friend_code = coalesce(friend_code, '9999' || right(replace(id::text, '-', ''), 8)),
      game_avatar = coalesce(game_avatar, 'pikachu:normal')
  where id::text like id_prefix || '%';
end
$$;

-- Test fixtures only: a player's id by Discord name, and back. Results from
-- search and Find New don't carry strangers' Discord names
-- (20261020001100_discord_friends_only.sql), so tests match rows by id.
-- plpgsql, so public.profiles only has to exist when they're called.
create function public.test_uid(name text) returns uuid
language plpgsql stable security definer
as $$ begin return (select id from public.profiles where discord_username = name); end $$;
create function public.test_name(uid uuid) returns text
language plpgsql stable security definer
as $$ begin return (select discord_username from public.profiles where id = uid); end $$;
