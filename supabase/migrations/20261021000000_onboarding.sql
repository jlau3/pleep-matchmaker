-- Onboarding state on the profile:
--   setup_done: the "Get set up" checklist (Profile -> Vote -> Add friends ->
--     Tier List) is finished or skipped, so it never shows again.
--   vote_guide_seen: the voting guide on My Votes has opened once by itself;
--     after that it only opens from its button.
-- Players who already have a friend count as set up, and players who've voted
-- have seen the guide, so only new players get either. Safe to re-run (each
-- backfill only happens when its column is first added).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'setup_done'
  ) then
    alter table public.profiles add column setup_done boolean not null default false;
    update public.profiles pr set setup_done = true
    where exists (select 1 from public.friends f where f.user_id = pr.id);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'vote_guide_seen'
  ) then
    alter table public.profiles add column vote_guide_seen boolean not null default false;
    update public.profiles pr set vote_guide_seen = true
    where exists (select 1 from public.preferences p where p.user_id = pr.id and p.choice <> 'undecided');
  end if;
end
$$;

grant update (setup_done, vote_guide_seen) on public.profiles to authenticated;
