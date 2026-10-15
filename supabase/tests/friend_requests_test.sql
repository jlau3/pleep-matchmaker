\set ON_ERROR_STOP on

-- 20261019000000_friend_requests.sql: requests and accepts instead of one-way adds.
-- ann, bob, cal (closed to new friends), dee, and eve.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0020-000000000001', '{"name":"fr_ann#0"}'),
  ('00000000-0000-0000-0020-000000000002', '{"name":"fr_bob#0"}'),
  ('00000000-0000-0000-0020-000000000003', '{"name":"fr_cal#0"}'),
  ('00000000-0000-0000-0020-000000000004', '{"name":"fr_dee#0"}'),
  ('00000000-0000-0000-0020-000000000005', '{"name":"fr_eve#0"}');
update public.profiles set friend_code = '200000000001' where id = '00000000-0000-0000-0020-000000000001';
update public.profiles set friend_code = '200000000002' where id = '00000000-0000-0000-0020-000000000002';
update public.profiles set friend_code = '200000000003', open_to_friends = false where id = '00000000-0000-0000-0020-000000000003';

set role authenticated;

-- 1. Ann asks Bob: nobody is on anyone's list yet.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000001', false);
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0020-000000000002') = 'sent', 'sent';
  assert public.send_friend_request('00000000-0000-0000-0020-000000000002') = 'sent', 'sending again is harmless';
  assert not exists (select 1 from public.get_friends()), 'no friends until accepted';
  assert (select status from public.get_sent_requests() where user_id = '00000000-0000-0000-0020-000000000002') = 'open', 'shows as sent';
  assert (select friend_code from public.get_sent_requests() where user_id = '00000000-0000-0000-0020-000000000002') = '200000000002', 'open player: code shown';
  begin
    insert into public.friend_requests (from_id, to_id) values (auth.uid(), '00000000-0000-0000-0020-000000000004');
    assert false, 'requests only through the functions';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Bob sees it, with Ann's code (she asked), and accepts: both lists.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000002', false);
do $$ begin
  assert (select friend_code from public.get_friend_requests() where user_id = '00000000-0000-0000-0020-000000000001') = '200000000001', 'sender code shown';
  perform public.accept_friend_request('00000000-0000-0000-0020-000000000001');
  assert exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0020-000000000001'), 'Ann on Bob''s list';
  assert not exists (select 1 from public.get_friend_requests()), 'request gone';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000001', false);
do $$ begin
  assert exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0020-000000000002'), 'Bob on Ann''s list';
  assert not exists (select 1 from public.get_sent_requests()), 'nothing pending';
  assert public.send_friend_request('00000000-0000-0000-0020-000000000002') = 'friends', 'already friends';
end $$;

-- 2. Ann asks Cal (closed): code hidden from Ann; Cal declines, Ann sees it, clears it, asks again.
do $$ begin
  perform public.send_friend_request('00000000-0000-0000-0020-000000000003');
  assert (select friend_code from public.get_sent_requests() where user_id = '00000000-0000-0000-0020-000000000003') is null, 'closed player: code hidden';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000003', false);
select public.decline_friend_request('00000000-0000-0000-0020-000000000001');
do $$ begin
  assert not exists (select 1 from public.get_friend_requests()), 'declined leaves Cal''s list';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000001', false);
do $$ begin
  assert (select status from public.get_sent_requests() where user_id = '00000000-0000-0000-0020-000000000003') = 'declined', 'Ann sees the decline';
  perform public.cancel_friend_request('00000000-0000-0000-0020-000000000003');
  assert not exists (select 1 from public.get_sent_requests() where user_id = '00000000-0000-0000-0020-000000000003'), 'cleared';
  assert public.send_friend_request('00000000-0000-0000-0020-000000000003') = 'sent', 'can ask again';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000003', false);
do $$ begin
  begin
    perform public.accept_friend_request('00000000-0000-0000-0020-000000000004');
    assert false, 'can''t accept a request that doesn''t exist';
  exception when raise_exception then
    assert sqlerrm = 'request_gone', sqlerrm;
  end;
end $$;

-- 3. Crossed requests: Dee asks Eve, Eve asks Dee, they're friends.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000004', false);
select public.send_friend_request('00000000-0000-0000-0020-000000000005');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000005', false);
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0020-000000000004') = 'friends', 'crossed requests accept';
  assert exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0020-000000000004'), 'Dee on Eve''s list';
end $$;

-- 4. A block drops requests both ways; requests lapse after 30 days.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000004', false);
select public.send_friend_request('00000000-0000-0000-0020-000000000002');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000002', false);
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0020-000000000004');
reset role;
do $$ begin
  assert not exists (select 1 from public.friend_requests where from_id = '00000000-0000-0000-0020-000000000004' and to_id = '00000000-0000-0000-0020-000000000002'), 'block drops it';
end $$;
update public.friend_requests set created_at = now() - interval '31 days'
where from_id = '00000000-0000-0000-0020-000000000001' and to_id = '00000000-0000-0000-0020-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000003', false);
do $$ begin
  assert not exists (select 1 from public.get_friend_requests()), 'lapsed';
  begin
    perform public.accept_friend_request('00000000-0000-0000-0020-000000000001');
    assert false, 'can''t accept a lapsed request';
  exception when raise_exception then null;
  end;
end $$;

-- 5. Their list full: accepting fails cleanly, nothing half-done.
reset role;
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0021-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'fr_x' || g || '#0')
from generate_series(1, 50) g;
select public.test_befriend('00000000-0000-0000-0020-000000000005', ('00000000-0000-0000-0021-' || lpad(g::text, 12, '0'))::uuid)
from generate_series(1, 48) g;
-- Eve (49 friends) asks Cal, then fills her list before Cal answers.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000005', false);
select public.send_friend_request('00000000-0000-0000-0020-000000000003');
reset role;
select public.test_befriend('00000000-0000-0000-0020-000000000005', '00000000-0000-0000-0021-000000000050');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0020-000000000003', false);
do $$ begin
  begin
    perform public.accept_friend_request('00000000-0000-0000-0020-000000000005');
    assert false, 'their list is full';
  exception when raise_exception then
    assert sqlerrm = 'their_list_full', sqlerrm;
  end;
  assert not exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0020-000000000005'), 'no half friendship';
end $$;
reset role;

-- 6. Re-running the migration turns a leftover one-way add into a request.
insert into public.friends (user_id, friend_id) values ('00000000-0000-0000-0020-000000000004', '00000000-0000-0000-0020-000000000003');
\ir ../migrations/20261019000000_friend_requests.sql
do $$ begin
  assert not exists (select 1 from public.friends where user_id = '00000000-0000-0000-0020-000000000004' and friend_id = '00000000-0000-0000-0020-000000000003'), 'one-way add removed';
  assert (select status from public.friend_requests where from_id = '00000000-0000-0000-0020-000000000004' and to_id = '00000000-0000-0000-0020-000000000003') = 'open', 'now a request';
  assert exists (select 1 from public.friends where user_id = '00000000-0000-0000-0020-000000000002' and friend_id = '00000000-0000-0000-0020-000000000001'), 'mutual friends kept';
end $$;

\echo 'ALL FRIEND REQUEST TESTS PASSED'
