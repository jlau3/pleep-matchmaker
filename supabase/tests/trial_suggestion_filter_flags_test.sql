begin;
\ir ../migrations/20261026001000_suggestion_filter_flags.sql
insert into auth.users(id,raw_user_meta_data)
select ('00000000-0000-4000-00eb-'||lpad(n::text,12,'0'))::uuid,'{}'::jsonb from generate_series(1,8) n;
update public.profiles set ign='Filter '||right(id::text,1),friend_code='7000'||right(id::text,8),game_avatar='pikachu:normal',
 open_to_friends=true,allow_lookup=true,last_seen_at=now(),created_at=now()
where id::text like '00000000-0000-4000-00eb-%';
update public.profiles set created_at=now()-interval '14 days' where id='00000000-0000-4000-00eb-000000000002';
update public.profiles set created_at=now()-interval '15 days' where id='00000000-0000-4000-00eb-000000000003';
update public.profiles set allow_lookup=false where id='00000000-0000-4000-00eb-000000000005';
insert into public.blocks(blocker_id,blocked_id) values ('00000000-0000-4000-00eb-000000000006','00000000-0000-4000-00eb-000000000001');
insert into public.friend_requests(from_id,to_id,status) values
 ('00000000-0000-4000-00eb-000000000001','00000000-0000-4000-00eb-000000000002','declined'),
 ('00000000-0000-4000-00eb-000000000003','00000000-0000-4000-00eb-000000000001','declined'),
 ('00000000-0000-4000-00eb-000000000008','00000000-0000-4000-00eb-000000000004','declined');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00eb-000000000001',true);
do $$ declare ids uuid[]:=array(select ('00000000-0000-4000-00eb-'||lpad(n::text,12,'0'))::uuid from generate_series(2,6)n); begin
 assert (select count(*) from public.get_suggestion_filter_flags(ids))=3,'ineligible candidate filter metadata leaked';
 assert (select is_new and has_declined from public.get_suggestion_filter_flags(ids) where user_id=ids[1]),'new boundary or outgoing decline missing';
 assert (select not is_new and has_declined from public.get_suggestion_filter_flags(ids) where user_id=ids[2]),'old account or incoming decline missing';
 assert (select is_new and not has_declined from public.get_suggestion_filter_flags(ids) where user_id=ids[3]),'third-party decline leaked';
 assert not exists(select 1 from public.get_suggestion_filter_flags(array[]::uuid[])),'empty request returned profiles';
 assert not has_function_privilege('anon','public.get_suggestion_filter_flags(uuid[])','execute'),'anonymous API access';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00eb-000000000008',true);
do $$ begin
 assert (select not has_declined from public.get_suggestion_filter_flags(array['00000000-0000-4000-00eb-000000000002'::uuid])),'other viewer inherited decline';
 assert (select has_declined from public.get_suggestion_filter_flags(array['00000000-0000-4000-00eb-000000000004'::uuid])),'own decline missing for second viewer';
end $$;
reset role;
delete from public.friend_requests where from_id='00000000-0000-4000-00eb-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00eb-000000000001',true);
do $$ begin
 assert (select not has_declined from public.get_suggestion_filter_flags(array['00000000-0000-4000-00eb-000000000002'::uuid])),'cleared request incorrectly described as retained history';
end $$;
rollback;
\echo 'SUGGESTION FILTER FLAG PRIVACY TESTS PASSED'
