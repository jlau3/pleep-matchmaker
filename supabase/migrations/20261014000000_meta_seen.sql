-- Which new-Pokémon meta note (src/content/meta.tsx) a player has dismissed.
-- The active note pops up once per account; a new note has a new id, so it
-- pops up again. Safe to re-run.

alter table public.profiles add column if not exists meta_seen_id text;

grant update (meta_seen_id) on public.profiles to authenticated;
