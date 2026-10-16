\set ON_ERROR_STOP on
begin;
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0097-' || lpad(i::text, 12, '0'))::uuid, jsonb_build_object('name', 'icon' || i || '#0')
from generate_series(1, 3) i;
select public.test_complete_profiles('00000000-0000-0000-0097-');
update public.profiles set ign = 'SocialIconTarget2' where id = '00000000-0000-0000-0097-000000000002';
update public.profiles set game_avatar = null where id in ('00000000-0000-0000-0097-000000000001', '00000000-0000-0000-0097-000000000003');
insert into public.friend_requests(from_id, to_id) values ('00000000-0000-0000-0097-000000000002', '00000000-0000-0000-0097-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0097-000000000001', false);
do $$ begin
 assert not public.social_profile_ready(auth.uid()), 'name and code without icon is incomplete';
 assert not exists (select 1 from public.lookup_players('SocialIconTarget2')), 'search needs own icon';
 assert not exists (select 1 from public.browse_all()), 'Find New needs own icon';
 assert not exists (select 1 from public.browse_players()), 'paged Find New needs own icon';
 begin
  perform public.send_friend_request('00000000-0000-0000-0097-000000000002');
  assert false, 'cannot send without icon';
 exception when raise_exception then assert sqlerrm = 'profile_incomplete', sqlerrm; end;
 begin
  perform public.accept_friend_request('00000000-0000-0000-0097-000000000002');
  assert false, 'cannot accept without icon';
 exception when raise_exception then assert sqlerrm = 'profile_incomplete', sqlerrm; end;
end $$;
update public.profiles set game_avatar = 'pikachu:normal' where id = auth.uid();
do $$ begin
 assert public.social_profile_ready(auth.uid()), 'saved icon completes identity';
 assert exists (select 1 from public.lookup_players('SocialIconTarget2')), 'search works after choosing icon';
 assert not exists (select 1 from public.browse_all() where user_id = '00000000-0000-0000-0097-000000000003'), 'no icon: not a candidate';
end $$;
select public.accept_friend_request('00000000-0000-0000-0097-000000000002');
do $$ begin
 assert exists (select 1 from public.get_friends() where user_id = '00000000-0000-0000-0097-000000000002'), 'accept succeeds with complete profile';
end $$;
reset role;
rollback;
\echo 'ALL SOCIAL ICON TESTS PASSED'
