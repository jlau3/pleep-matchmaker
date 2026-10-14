\set ON_ERROR_STOP on

-- me marks ann and bob pending; adding ann clears hers, blocking bob clears his.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0014-000000000001', '{"name":"pf_me#0"}'),
  ('00000000-0000-0000-0014-000000000002', '{"name":"pf_ann#0"}'),
  ('00000000-0000-0000-0014-000000000003', '{"name":"pf_bob#0"}'),
  ('00000000-0000-0000-0014-000000000004', '{"name":"pf_cal#0"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0014-000000000001', false);
insert into public.pending_friends (user_id, target_id) values
  (auth.uid(), '00000000-0000-0000-0014-000000000002'),
  (auth.uid(), '00000000-0000-0000-0014-000000000003'),
  (auth.uid(), '00000000-0000-0000-0014-000000000004');
do $$ begin
  assert (select count(*) from public.get_pending_friends()) = 3, 'three pending';
  begin
    insert into public.pending_friends (user_id, target_id) values ('00000000-0000-0000-0014-000000000002', auth.uid());
    assert false, 'can''t write someone else''s';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-0014-000000000002');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0014-000000000003');
delete from public.pending_friends where target_id = '00000000-0000-0000-0014-000000000004';
do $$ begin
  assert not exists (select 1 from public.pending_friends), 'added, blocked and cancelled all clear';
  assert not exists (select 1 from public.get_pending_friends()), 'nothing pending';
end $$;

-- Others can't see your pending list.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0014-000000000002', false);
insert into public.pending_friends (user_id, target_id) values (auth.uid(), '00000000-0000-0000-0014-000000000004');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0014-000000000001', false);
do $$ begin
  assert (select count(*) from public.pending_friends) = 0, 'RLS';
end $$;
reset role;

\echo 'ALL PENDING FRIENDS TESTS PASSED'
