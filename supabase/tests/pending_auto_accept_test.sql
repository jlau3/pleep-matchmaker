\set ON_ERROR_STOP on

-- 20261018000300_pending_auto_accept.sql: an accepted request doesn't need accepting again.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0019-000000000001', '{"name":"pa_ann#0"}'),
  ('00000000-0000-0000-0019-000000000002', '{"name":"pa_bob#0"}'),
  ('00000000-0000-0000-0019-000000000003', '{"name":"pa_cal#0"}');

set role authenticated;
-- Ann sent Bob a request in the game.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0019-000000000001', false);
insert into public.pending_friends (user_id, target_id) values (auth.uid(), '00000000-0000-0000-0019-000000000002');

-- Bob accepts and adds Ann here; Cal adds Ann without any request from her.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0019-000000000002', false);
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0019-000000000001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0019-000000000003', false);
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0019-000000000001');
reset role;

do $$ begin
  assert exists (select 1 from public.friends where user_id = '00000000-0000-0000-0019-000000000001'
                 and friend_id = '00000000-0000-0000-0019-000000000002'), 'Bob is on Ann''s list';
  assert not exists (select 1 from public.pending_friends where user_id = '00000000-0000-0000-0019-000000000001'),
    'and no longer pending';
  assert not exists (select 1 from public.friends where user_id = '00000000-0000-0000-0019-000000000001'
                     and friend_id = '00000000-0000-0000-0019-000000000003'), 'Cal still waits under Added you';
end $$;

\echo 'ALL PENDING AUTO-ACCEPT TESTS PASSED'
