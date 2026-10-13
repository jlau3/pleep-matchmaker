\set ON_ERROR_STOP on


insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'f' || g || '#0')
from generate_series(1, 52) g;
-- These players show their Discord name (new accounts start hidden; see show_discord_test.sql).
update public.profiles set show_discord = true;

insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0001-000000000002', 'pikachu', 'want'),
  ('00000000-0000-0000-0001-000000000002', 'eevee', 'dont_want'),
  ('00000000-0000-0000-0001-000000000003', 'pikachu', 'want');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000001', false);

insert into public.friends (user_id, friend_id) values
  (auth.uid(), '00000000-0000-0000-0001-000000000002'),
  (auth.uid(), '00000000-0000-0000-0001-000000000003');

do $$
declare r record;
begin
  assert (select count(*) from public.get_friends()) = 2, 'two friends';
  select * into r from public.get_friends() where discord_username = 'f2';
  assert r.visible and r.wants = '{pikachu}' and r.dont_wants = '{eevee}', 'friend prefs';
end $$;

-- Friend turns lookup off: names only.
reset role;
update public.profiles set allow_lookup = false where discord_username = 'f3';
set role authenticated;
do $$
declare r record;
begin
  select * into r from public.get_friends() where discord_username = 'f3';
  assert not r.visible and r.wants = '{}' and r.ign is null, 'hidden friend';
  begin
    insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0001-000000000004');
    -- f4 has lookup on; fine.
  end;
end $$;

-- Can't add someone with lookup off.
do $$ begin
  begin
    reset role;
    update public.profiles set allow_lookup = false where discord_username = 'f5';
    set role authenticated;
    insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0001-000000000005');
    assert false, 'should reject lookup-off add';
  exception when raise_exception then
    assert sqlerrm = 'friend_unavailable', sqlerrm;
  end;
end $$;

-- Cap at 50: currently 3 (f2, f3, f4). Add f6..f52 = 47 more -> 50, then one more fails.
insert into public.friends (user_id, friend_id)
select auth.uid(), ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid from generate_series(6, 52) g;
do $$ begin
  assert (select count(*) from public.friends where user_id = auth.uid()) = 50, 'at cap';
end $$;
reset role;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0001-000000000099', '{"name":"extra#0"}');
set role authenticated;
do $$ begin
  begin
    insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0001-000000000099');
    assert false, 'should reject 51st friend';
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
reset role;
insert into public.friends (user_id, friend_id) values ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0001-000000000006');
set role authenticated;
do $$ begin
  assert (select count(*) from public.friends where user_id <> auth.uid()) = 0, 'friends RLS';
end $$;

-- A full friend list (f1 has 50) hides you from other people's matches,
-- without touching open_to_friends; dropping below the cap brings you back.
-- (Blocking f2 above dropped f1 to 49; top back up.)
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0001-000000000099');
reset role;
update public.profiles set friend_code = '111122223333' where discord_username in ('f1', 'f4');
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000004']) u,
     unnest(array['a1', 'a2', 'a3']) l;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000004', false);
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.get_matches() where discord_username = 'f1'), 'full list hidden from matches';
  assert exists (select 1 from public.lookup_players('f1')), 'full list still found by lookup';
end $$;
reset role;
delete from public.friends where user_id = '00000000-0000-0000-0001-000000000001' and friend_id = '00000000-0000-0000-0001-000000000052';
set role authenticated;
do $$ begin
  assert exists (select 1 from public.get_matches() where discord_username = 'f1'), 'back in matches below cap';
end $$;
reset role;
do $$ begin
  assert (select open_to_friends from public.profiles where discord_username = 'f1'), 'setting untouched';
end $$;

\echo 'ALL FRIENDS TESTS PASSED'
