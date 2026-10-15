\set ON_ERROR_STOP on

-- 20261021000900_codes_on_requests.sql: friend codes travel only with
-- friend requests, and are dropped once you're friends.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0037-000000000001', '{"name":"cor_ann#0"}'),
  ('00000000-0000-0000-0037-000000000002', '{"name":"cor_bob#0"}');
update public.profiles set ign = 'CorAnn', friend_code = '737300000001' where id = '00000000-0000-0000-0037-000000000001';
update public.profiles set ign = 'CorBob', friend_code = '737300000002' where id = '00000000-0000-0000-0037-000000000002';
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0037-00000000000' || u)::uuid, l, 'want'::public.choice
from generate_series(1, 2) u, unnest(array['ca', 'cb', 'cc']) l;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0037-000000000002', false);
do $$ begin
  assert (select friend_code from public.lookup_players('CorAnn') where user_id = '00000000-0000-0000-0037-000000000001') is null, 'search by IGN: hidden';
  assert (select friend_code from public.lookup_players('7373 0000 0001') where user_id = '00000000-0000-0000-0037-000000000001') = '737300000001', 'typed: shown';
  assert not exists (select 1 from public.browse_all() where friend_code is not null), 'Find New: never';
  assert (select friend_code from public.lookup_players('CorBob') where user_id = auth.uid()) = '737300000002', 'your own: shown';
end $$;

-- Ann asks Bob: Bob gets Ann's code (in requests and in search); Ann doesn't get Bob's.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0037-000000000001', false);
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0037-000000000002') = 'sent';
  assert (select friend_code from public.get_sent_requests() where user_id = '00000000-0000-0000-0037-000000000002') is null, 'asker doesn''t get theirs';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0037-000000000002', false);
do $$ begin
  assert (select friend_code from public.get_friend_requests() where user_id = '00000000-0000-0000-0037-000000000001') = '737300000001', 'request carries it';
  assert (select friend_code from public.lookup_players('CorAnn') where user_id = '00000000-0000-0000-0037-000000000001') = '737300000001', 'and search, while asked';
  perform public.accept_friend_request('00000000-0000-0000-0037-000000000001');
  assert (select friend_code from public.get_friends() where user_id = '00000000-0000-0000-0037-000000000001') is null, 'friends: dropped';
  assert (select friend_code from public.lookup_players('CorAnn') where user_id = '00000000-0000-0000-0037-000000000001') is null, 'friends: not in search either';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name in ('code_visibility', 'share_code')),
    'old columns gone';
end $$;

\echo 'ALL CODES ON REQUESTS TESTS PASSED'
