-- Which version of the How it works popup a player has seen. The popup opens
-- by itself once per account, and once more whenever HELP_VERSION in
-- src/lib/help.ts goes above this. Existing players start at 0, so they all
-- see it once. Safe to re-run.

alter table public.profiles add column if not exists help_seen_version int not null default 0;

grant update (help_seen_version) on public.profiles to authenticated;
