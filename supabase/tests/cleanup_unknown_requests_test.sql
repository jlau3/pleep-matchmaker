\set ON_ERROR_STOP on
begin;
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0098-' || lpad(i::text, 12, '0'))::uuid, jsonb_build_object('name', 'cleanup' || i || '#0')
from generate_series(1, 7) i;
update public.profiles set ign = null, show_discord = false where id::text like '00000000-0000-0000-0098-%';
update public.profiles set ign = 'Recognizable IGN' where id = '00000000-0000-0000-0098-000000000003';
update public.profiles set show_discord = true where id = '00000000-0000-0000-0098-000000000004';
select public.test_befriend('00000000-0000-0000-0098-000000000001', '00000000-0000-0000-0098-000000000005');
insert into public.friend_requests(from_id, to_id, status)
select '00000000-0000-0000-0098-000000000001'::uuid,
 ('00000000-0000-0000-0098-' || lpad(i::text, 12, '0'))::uuid,
 case when i = 6 then 'declined' else 'open' end
from generate_series(2, 7) i;
update public.friend_requests set created_at = now() - interval '60 days'
where to_id = '00000000-0000-0000-0098-000000000007';
\ir ../migrations/20261024000000_clear_unknown_sent_requests.sql

do $$ begin
 assert (select count(*) from public.friend_requests where from_id = '00000000-0000-0000-0098-000000000001') = 3,
   'retain named profiles and existing friendships, remove unknown open/declined/expired requests';
 assert (select count(*) from public.removed_unknown_requests where request->>'from_id' = '00000000-0000-0000-0098-000000000001') = 3,
   'each deleted request has a backup';
 assert (select count(*) from public.profiles where id::text like '00000000-0000-0000-0098-%') = 7,
   'never delete profiles';
 assert exists (select 1 from public.friends where user_id = '00000000-0000-0000-0098-000000000001'),
   'never delete friendships';
end $$;
set role authenticated;
do $$ begin
 begin
  perform 1 from public.removed_unknown_requests;
  assert false, 'request backup is private';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'ALL UNKNOWN REQUEST CLEANUP TESTS PASSED'
