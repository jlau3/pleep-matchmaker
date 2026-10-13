\set ON_ERROR_STOP on

-- What the app does: plain insert to block (upsert needs UPDATE, which players
-- don't have), duplicate = already blocked, delete to unblock.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0008-000000000001', '{"name":"blocker#0"}'),
  ('00000000-0000-0000-0008-000000000002', '{"name":"blockee#0"}');
-- These players show their Discord name (new accounts start hidden; see show_discord_test.sql).
update public.profiles set show_discord = true;
update public.profiles set friend_code = '888800000002' where discord_username = 'blockee';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0008-000000000001', false);

insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0008-000000000002');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0008-000000000002');
do $$ begin
  assert (select count(*) from public.get_blocked()) = 1, 'blocked';
  assert not exists (select 1 from public.get_friends() where discord_username = 'blockee'), 'block unfriends';
  assert not exists (select 1 from public.lookup_players('blockee')), 'blocked hidden from lookup';
  begin
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0008-000000000002');
    assert false, 'duplicate should raise';
  exception when unique_violation then null; -- the app treats 23505 as "already blocked"
  end;
  begin
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0008-000000000002')
      on conflict (blocker_id, blocked_id) do update set blocked_id = excluded.blocked_id;
    assert false, 'upsert should be refused';
  exception when insufficient_privilege then null; -- why the old upsert silently failed
  end;
end $$;

delete from public.blocks where blocker_id = auth.uid() and blocked_id = '00000000-0000-0000-0008-000000000002';
do $$ begin
  assert (select count(*) from public.get_blocked()) = 0, 'unblocked';
  assert exists (select 1 from public.lookup_players('blockee')), 'visible again after unblock';
end $$;

\echo 'ALL BLOCK TESTS PASSED'
