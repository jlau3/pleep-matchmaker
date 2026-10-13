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
