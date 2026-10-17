-- Setup records taking a first step, not waiting for another player to accept.
alter table public.profiles add column friends_setup_started boolean not null default false;
grant update (friends_setup_started) on public.profiles to authenticated;
update public.profiles p set friends_setup_started = true
where exists (select 1 from public.friends f where f.user_id = p.id)
   or exists (select 1 from public.friend_requests r where r.from_id = p.id)
   or exists (select 1 from public.friend_placeholders h where h.user_id = p.id);
