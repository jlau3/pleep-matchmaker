\set ON_ERROR_STOP on


insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'f' || g || '#0')
from generate_series(1, 52) g;

insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0001-000000000002', 'pikachu', 'want'),
  ('00000000-0000-0000-0001-000000000002', 'eevee', 'dont_want'),
  ('00000000-0000-0000-0001-000000000003', 'pikachu', 'want');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000001', false);

select public.test_befriend(auth.uid(), '00000000-0000-0000-0001-000000000002');
select public.test_befriend(auth.uid(), '00000000-0000-0000-0001-000000000003');

-- Players can't write friendships directly; only a request and accept can.
do $$ begin
  begin
    insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0001-000000000004');
    assert false, 'direct insert should be refused';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare r record;
begin
  assert (select count(*) from public.get_friends()) = 2, 'two friends';
  select * into r from public.get_friends() where discord_username = 'f2';
  assert r.visible and r.wants = '{pikachu}' and r.dont_wants = '{eevee}', 'friend prefs';
end $$;

-- Friend turns search off: still a full friend (20261020000700_lookup_only_search.sql).
reset role;
update public.profiles set allow_lookup = false, ign = 'F3Ign' where discord_username = 'f3';
set role authenticated;
do $$
declare r record;
begin
  select * into r from public.get_friends() where discord_username = 'f3';
  assert r.visible and r.ign = 'F3Ign', 'unsearchable friend still shown in full';
  assert not exists (select 1 from public.lookup_players('F3Ign')), 'but not found by search';
end $$;
select public.test_befriend(auth.uid(), '00000000-0000-0000-0001-000000000004');

-- Search off doesn't block requests (e.g. from Find New).
reset role;
update public.profiles set allow_lookup = false where discord_username = 'f5';
select public.test_complete_profiles('00000000-0000-0000-0001-000000000001');
set role authenticated;
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0001-000000000005') = 'sent', 'request to a search-off player';
end $$;

-- Cap at 50: currently 3 (f2, f3, f4). Add f6..f52 = 47 more -> 50, then one more fails.
select public.test_befriend(auth.uid(), ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid) from generate_series(6, 52) g;
do $$ begin
  assert (select count(*) from public.friends where user_id = auth.uid()) = 50, 'at cap';
end $$;
reset role;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0001-000000000099', '{"name":"extra#0"}');
set role authenticated;
do $$ begin
  begin
    perform public.send_friend_request('00000000-0000-0000-0001-000000000099');
    assert false, 'should reject a request past 50 friends';
  exception when raise_exception then
    assert sqlerrm = 'friend_limit', sqlerrm;
  end;
end $$;

-- Blocking removes the friendship.
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0001-000000000002');
do $$ begin
  assert not exists (select 1 from public.get_friends() where discord_username = 'f2'), 'block unfriends';
end $$;

-- Can't read anyone else's friend list.
select public.test_befriend('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000006');
do $$ begin
  assert (select count(*) from public.friends where user_id <> auth.uid()) = 0, 'friends RLS';
end $$;

-- A full friend list (f1 has 50) hides you from other people's matches,
-- without touching open_to_friends; dropping below the cap brings you back.
-- (Blocking f2 above dropped f1 to 49; top back up.)
select public.test_befriend(auth.uid(), '00000000-0000-0000-0001-000000000099');
-- Seen from a player who isn't f1's friend (friends are left out of matches anyway).
reset role;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0001-000000000100', '{"name":"viewer#0"}');
update public.profiles set friend_code = '111122223333' where discord_username in ('f1', 'viewer');
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000100']) u,
     unnest(array['a1', 'a2', 'a3']) l;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000100', false);
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.browse_players('fit', true, 50, 0) where discord_username = 'f1'), 'full list hidden from matches';
  assert exists (select 1 from public.lookup_players('f1')), 'full list still found by lookup';
end $$;
reset role;
delete from public.friends where user_id = '00000000-0000-0000-0001-000000000001' and friend_id = '00000000-0000-0000-0001-000000000052';
set role authenticated;
do $$ begin
  assert exists (select 1 from public.browse_players('fit', true, 50, 0) where discord_username = 'f1'), 'back in matches below cap';
end $$;
reset role;
do $$ begin
  assert (select open_to_friends from public.profiles where discord_username = 'f1'), 'setting untouched';
end $$;

\echo 'ALL FRIENDS TESTS PASSED'
