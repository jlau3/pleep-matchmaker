\set ON_ERROR_STOP on

-- 20261020000300_request_needs_profile.sql: asking needs an IGN and a friend
-- code; answering a request doesn't. Ann has both, Bob neither, Cal no code.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0026-000000000001', '{"name":"rp_ann#0"}'),
  ('00000000-0000-0000-0026-000000000002', '{"name":"rp_bob#0"}'),
  ('00000000-0000-0000-0026-000000000003', '{"name":"rp_cal#0"}');
update public.profiles set ign = 'RpAnn', friend_code = '260000000001' where id = '00000000-0000-0000-0026-000000000001';
update public.profiles set ign = 'RpCal' where id = '00000000-0000-0000-0026-000000000003';

-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0026-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0026-000000000002', false);
do $$ begin
  begin
    perform public.send_friend_request('00000000-0000-0000-0026-000000000001');
    assert false, 'no IGN or code: can''t ask';
  exception when raise_exception then
    assert sqlerrm = 'profile_incomplete', sqlerrm;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0026-000000000003', false);
do $$ begin
  begin
    perform public.send_friend_request('00000000-0000-0000-0026-000000000001');
    assert false, 'IGN but no code: can''t ask';
  exception when raise_exception then
    assert sqlerrm = 'profile_incomplete', sqlerrm;
  end;
end $$;

-- Ann asks Bob; Bob can't accept without IGN and code (20261021000700), but
-- can once he adds them, or answer by asking back.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0026-000000000001', false);
select public.send_friend_request('00000000-0000-0000-0026-000000000002');
select public.send_friend_request('00000000-0000-0000-0026-000000000003');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0026-000000000002', false);
do $$ begin
  begin
    perform public.accept_friend_request('00000000-0000-0000-0026-000000000001');
    assert false, 'no profile: can''t accept';
  exception when raise_exception then
    assert sqlerrm = 'profile_incomplete', sqlerrm;
  end;
end $$;
update public.profiles set ign = 'RnpBob', friend_code = '262600000002' where id = auth.uid();
do $$ begin
  perform public.accept_friend_request('00000000-0000-0000-0026-000000000001');
  assert exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0026-000000000001'), 'accepted';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0026-000000000003', false);
do $$ begin
  begin
    perform public.send_friend_request('00000000-0000-0000-0026-000000000001');
    assert false, 'asking back without a code is accepting without one';
  exception when raise_exception then
    assert sqlerrm = 'profile_incomplete', sqlerrm;
  end;
end $$;
update public.profiles set friend_code = '262600000003' where id = auth.uid();
do $$ begin
  assert public.send_friend_request('00000000-0000-0000-0026-000000000001') = 'friends', 'asking back accepts';
end $$;
reset role;

\echo 'ALL REQUEST NEEDS PROFILE TESTS PASSED'
