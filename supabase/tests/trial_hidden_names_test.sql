begin;
\ir ../migrations/20261026000800_hidden_suggestion_names.sql
insert into auth.users(id,raw_user_meta_data)
select ('00000000-0000-4000-00ed-'||lpad(n::text,12,'0'))::uuid,'{}'::jsonb
from generate_series(1,6) n;
update public.profiles set ign='Hidden '||right(id::text,1),allow_lookup=true,
 open_to_friends=false,last_seen_at=now()-interval '3 months'
where id::text like '00000000-0000-4000-00ed-%';
insert into public.hidden_suggestions(user_id,hidden_user_id)
select '00000000-0000-4000-00ed-000000000001',
 ('00000000-0000-4000-00ed-'||lpad(n::text,12,'0'))::uuid from generate_series(2,5) n;
update public.profiles set allow_lookup=false where id in
 ('00000000-0000-4000-00ed-000000000003','00000000-0000-4000-00ed-000000000005');
insert into public.blocks(blocker_id,blocked_id) values
 ('00000000-0000-4000-00ed-000000000004','00000000-0000-4000-00ed-000000000001');
select public.test_befriend('00000000-0000-4000-00ed-000000000001','00000000-0000-4000-00ed-000000000005');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00ed-000000000001',true);
do $$ begin
 assert (select count(*) from public.get_hidden_suggestions())=4,'missing restore entries';
 assert (select ign='Hidden 2' from public.get_hidden_suggestions() where user_id='00000000-0000-4000-00ed-000000000002'),'closed/inactive player lost name';
 assert (select ign is null from public.get_hidden_suggestions() where user_id='00000000-0000-4000-00ed-000000000003'),'lookup-off name leaked';
 assert (select ign is null from public.get_hidden_suggestions() where user_id='00000000-0000-4000-00ed-000000000004'),'blocked name leaked';
 assert (select ign='Hidden 5' from public.get_hidden_suggestions() where user_id='00000000-0000-4000-00ed-000000000005'),'existing friend lost identity';
 assert not exists(select 1 from public.get_hidden_suggestions() where user_id='00000000-0000-4000-00ed-000000000006'),'unhidden player leaked';
 assert not has_function_privilege('anon','public.get_hidden_suggestions()','execute'),'anonymous API access';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00ed-000000000002',true);
do $$ begin
 assert not exists(select 1 from public.get_hidden_suggestions()),'another viewer can read hidden entries';
end $$;
rollback;
\echo 'HIDDEN SUGGESTION LABEL PRIVACY TESTS PASSED'
