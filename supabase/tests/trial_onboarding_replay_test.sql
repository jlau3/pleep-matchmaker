begin;
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-00ef-000000000001','{}'),
 ('00000000-0000-4000-00ef-000000000002','{}');
update public.profiles set ign='Replay tester', friend_code='123456789012',game_avatar='pikachu:normal',
 open_to_friends=false,allow_lookup=true,votes_private=true,show_discord=false,
 help_seen_version=1,setup_done=true,vote_guide_seen=true,match_guide_seen=true
where id='00000000-0000-4000-00ef-000000000001';
insert into public.preferences(user_id,line_id,choice,top) values
 ('00000000-0000-4000-00ef-000000000001','pikachu','want',true);
select public.test_befriend('00000000-0000-4000-00ef-000000000001','00000000-0000-4000-00ef-000000000002');
create temp table replay_profile_before on commit drop as
select to_jsonb(p)-array['help_seen_version','setup_done','vote_guide_seen','match_guide_seen'] preserved
from public.profiles p where id='00000000-0000-4000-00ef-000000000001';
\ir ../migrations/20261026000700_replay_onboarding.sql
do $$ begin
 assert (select help_seen_version=0 and not setup_done and not vote_guide_seen and not match_guide_seen
  from public.profiles where id='00000000-0000-4000-00ef-000000000001'),'onboarding did not reset';
 assert (select to_jsonb(p)-array['help_seen_version','setup_done','vote_guide_seen','match_guide_seen']=b.preserved
  from public.profiles p cross join replay_profile_before b
  where id='00000000-0000-4000-00ef-000000000001'),'profile/privacy changed';
 assert exists(select 1 from public.preferences where user_id='00000000-0000-4000-00ef-000000000001'
  and line_id='pikachu' and choice='want' and top),'vote/Spotlight changed';
 assert (select count(*) from public.friends where user_id='00000000-0000-4000-00ef-000000000001')=1,'friend lost';
end $$;
rollback;
\echo 'ONBOARDING REPLAY PRESERVATION TESTS PASSED'
