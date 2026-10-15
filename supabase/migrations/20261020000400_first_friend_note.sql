-- One-time "You have your first friend!" note: shown on the next page a
-- player opens once they have a friend, until they close it or follow its
-- link. Players who already have friends when this first runs are marked as
-- noted, so only new friendships trigger it. Safe to re-run (the backfill
-- only happens when the column is first added).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'first_friend_noted'
  ) then
    alter table public.profiles add column first_friend_noted boolean not null default false;
    update public.profiles pr set first_friend_noted = true
    where exists (select 1 from public.friends f where f.user_id = pr.id);
  end if;
end
$$;

grant update (first_friend_noted) on public.profiles to authenticated;
