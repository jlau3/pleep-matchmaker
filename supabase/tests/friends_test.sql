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

\echo 'ALL FRIENDS TESTS PASSED'
