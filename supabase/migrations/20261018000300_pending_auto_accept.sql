-- No accepting the accept: if you marked someone pending (you sent them a
-- request in Pokémon Sleep) and they add you here, they go straight onto your
-- list too, instead of waiting under Added you for a second tap. Skipped
-- quietly if it can't be done (your list is full, they turned lookup off);
-- then they stay under Pending and Added you as before. Also settles requests
-- that were already accepted this way before this ran. Safe to re-run.

create or replace function public.accept_pending_friend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.pending_friends where user_id = new.friend_id and target_id = new.user_id)
     and not exists (select 1 from public.friends where user_id = new.friend_id and friend_id = new.user_id) then
    begin
      -- Clears their pending row (friends_clear_pending).
      insert into public.friends (user_id, friend_id) values (new.friend_id, new.user_id);
    exception when raise_exception or unique_violation then
      null;
    end;
  end if;
  return new;
end
$$;

drop trigger if exists friends_accept_pending on public.friends;
create trigger friends_accept_pending after insert on public.friends
  for each row execute function public.accept_pending_friend();

-- Requests already accepted on this site before the trigger existed.
do $$
declare
  r record;
begin
  for r in
    select p.user_id, p.target_id
    from public.pending_friends p
    join public.friends f on f.user_id = p.target_id and f.friend_id = p.user_id
  loop
    begin
      insert into public.friends (user_id, friend_id) values (r.user_id, r.target_id) on conflict do nothing;
    exception when raise_exception then
      null;
    end;
  end loop;
end
$$;
