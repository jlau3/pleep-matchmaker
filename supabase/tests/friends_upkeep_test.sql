\set ON_ERROR_STOP on

-- me, ann (closed to new friends), bob, and cal (who blocked me).
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0015-000000000001', '{"name":"fu_me#0"}'),
  ('00000000-0000-0000-0015-000000000002', '{"name":"fu_ann#0"}'),
  ('00000000-0000-0000-0015-000000000003', '{"name":"fu_bob#0"}'),
  ('00000000-0000-0000-0015-000000000004', '{"name":"fu_cal#0"}');
update public.profiles set ign = 'FuAnnIgn', friend_code = '771122223377', open_to_friends = false
  where id = '00000000-0000-0000-0015-000000000002';
update public.profiles set ign = 'FuBobIgn', friend_code = '444455556666'
  where id = '00000000-0000-0000-0015-000000000003';
update public.profiles set ign = 'FuCalIgn' where id = '00000000-0000-0000-0015-000000000004';
insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0015-000000000004', '00000000-0000-0000-0015-000000000001');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0015-000000000001', false);

-- 1. Closed: found by name with the code hidden, by code with it shown.
do $$ begin
  assert (select friend_code from public.lookup_players('FuAnnIgn') where user_id = '00000000-0000-0000-0015-000000000002') is null, 'closed hides the code';
  assert (select friend_code from public.lookup_players('7711 2222 3377') where user_id = '00000000-0000-0000-0015-000000000002') = '771122223377', 'typing the code finds it';
  assert (select friend_code from public.lookup_players('FuBobIgn') where user_id = '00000000-0000-0000-0015-000000000003') = '444455556666', 'open shows it';
end $$;

-- 2. Unfriending removes both sides.
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0015-000000000002');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0015-000000000002', false);
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0015-000000000001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0015-000000000001', false);
do $$ begin
  assert (select friend_code from public.lookup_players('FuAnnIgn') where user_id = '00000000-0000-0000-0015-000000000002') = '771122223377', 'friends see it';
end $$;
delete from public.friends where user_id = auth.uid() and friend_id = '00000000-0000-0000-0015-000000000002';
reset role;
do $$ begin
  assert not exists (
    select 1 from public.friends
    where user_id in ('00000000-0000-0000-0015-000000000001', '00000000-0000-0000-0015-000000000002')
  ), 'gone both ways';
end $$;
set role authenticated;

-- 3. Placeholders: found flag, exact IGN only, blocks hide, adding the friend clears it.
insert into public.friend_placeholders (user_id, name) values
  (auth.uid(), 'fubobign'), (auth.uid(), 'FuCalIgn'), (auth.uid(), 'Not Here Yet');
do $$ begin
  assert (select signed_up from public.get_friend_placeholders() where name = 'fubobign'), 'bob found, any case';
  assert not (select signed_up from public.get_friend_placeholders() where name = 'FuCalIgn'), 'blocked stays hidden';
  assert not (select signed_up from public.get_friend_placeholders() where name = 'Not Here Yet'), 'not signed up';
  begin
    insert into public.friend_placeholders (user_id, name) values (auth.uid(), 'FUBOBIGN');
    assert false, 'duplicate by search key';
  exception when unique_violation then null;
  end;
  begin
    insert into public.friend_placeholders (user_id, name) values ('00000000-0000-0000-0015-000000000002', 'x');
    assert false, 'can''t write someone else''s';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0015-000000000003');
do $$ begin
  assert (select count(*) from public.get_friend_placeholders()) = 2, 'adding bob cleared his';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0015-000000000002', false);
do $$ begin
  assert not exists (select 1 from public.friend_placeholders), 'RLS';
end $$;
reset role;

\echo 'ALL FRIENDS UPKEEP TESTS PASSED'
