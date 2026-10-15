\set ON_ERROR_STOP on

-- ann votes and goes private; bob is on ann's list, cal isn't.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0016-000000000001', '{"name":"px_ann#0"}'),
  ('00000000-0000-0000-0016-000000000002', '{"name":"px_bob#0"}'),
  ('00000000-0000-0000-0016-000000000003', '{"name":"px_cal#0"}');
update public.profiles set ign = 'PxAnnIgn' where id = '00000000-0000-0000-0016-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0016-000000000001', false);
insert into public.preferences (user_id, line_id, choice, top) values
  (auth.uid(), 'pikachu', 'want', true), (auth.uid(), 'eevee', 'dont_want', false);
update public.profiles set votes_private = true, game_avatar = 'pikachu:happy_shiny', reddit_username = 'ann_r'
  where id = auth.uid();
do $$ begin
  begin
    update public.profiles set game_avatar = 'pikachu:sleepy' where id = auth.uid();
    assert false, 'bad variant rejected';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set reddit_username = 'no spaces allowed' where id = auth.uid();
    assert false, 'bad reddit name rejected';
  exception when check_violation then null;
  end;
  assert (select wants from public.lookup_players('PxAnnIgn') where user_id = auth.uid()) = '{pikachu}', 'own lists stay visible';
end $$;
select public.test_befriend(auth.uid(), '00000000-0000-0000-0016-000000000002');

-- bob (on ann's list) sees her lists; cal doesn't, but still finds her.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0016-000000000002', false);
do $$ begin
  assert (select wants from public.lookup_players('PxAnnIgn') where user_id = '00000000-0000-0000-0016-000000000001') = '{pikachu}', 'friend sees wants';
  assert not (select votes_hidden from public.player_extras(array['00000000-0000-0000-0016-000000000001'::uuid])), 'friend: not hidden';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0016-000000000003', false);
select public.send_friend_request('00000000-0000-0000-0016-000000000001');
do $$ begin
  assert (select wants from public.lookup_players('PxAnnIgn') where user_id = '00000000-0000-0000-0016-000000000001') = '{}', 'stranger: no wants';
  assert (select top_wants from public.lookup_players('PxAnnIgn') where user_id = '00000000-0000-0000-0016-000000000001') = '{}', 'stranger: no Top 3';
  assert not exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0016-000000000001'), 'a request alone isn''t a friendship';
  assert (select game_avatar from public.player_extras(array['00000000-0000-0000-0016-000000000001'::uuid])) = 'pikachu:happy_shiny', 'icon';
  assert (select reddit_username from public.player_extras(array['00000000-0000-0000-0016-000000000001'::uuid])) = 'ann_r', 'reddit';
  assert (select votes_hidden from public.player_extras(array['00000000-0000-0000-0016-000000000001'::uuid])), 'stranger: votes flagged hidden';
end $$;
reset role;

\echo 'ALL PROFILE EXTRAS TESTS PASSED'
