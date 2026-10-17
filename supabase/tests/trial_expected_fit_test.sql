\set ON_ERROR_STOP on
begin;
-- Independent exact arithmetic fixture. Prior disabled only for this section;
-- the next section verifies the real k=5 blend and its baseline.
create or replace function public.demand_prior_votes() returns numeric language sql immutable as $$ select 0::numeric $$;
insert into auth.users(id,raw_user_meta_data)
select ('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('name','trial_'||n)
from generate_series(1,24) n;
update public.profiles set ign='Trial '||right(id::text,2),friend_code='6000'||right(id::text,8),game_avatar='pikachu:normal'
where id::text like '00000000-0000-0000-00ee-%';
-- 14 friends: 8 Want Pika, 4 Eevee, 2 Bulbasaur. Each contributes one Want.
insert into public.preferences(user_id,line_id,choice)
select ('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid,
 case when n<=18 then 'pikachu' when n<=22 then 'eevee' else 'bulbasaur' end,'want'::public.choice
from generate_series(11,24) n;
insert into public.friends(user_id,friend_id)
select ('00000000-0000-0000-00ee-'||lpad(actor::text,12,'0'))::uuid,
 ('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid
from generate_series(11,24) n cross join generate_series(1,2) actor;
insert into public.preferences(user_id,line_id,choice)
select ('00000000-0000-0000-00ee-'||lpad(actor::text,12,'0'))::uuid,l,case when l='eevee' then 'dont_want'::public.choice else 'want'::public.choice end
from generate_series(1,2) actor cross join unnest(array['pikachu','eevee','bulbasaur']) l;
insert into public.preferences(user_id,line_id,choice) values
('00000000-0000-0000-00ee-000000000004','pikachu','undecided'),
('00000000-0000-0000-00ee-000000000005','pikachu','dont_want'),
('00000000-0000-0000-00ee-000000000006','bulbasaur','want'),
('00000000-0000-0000-00ee-000000000006','eevee','dont_want');
select set_config('request.jwt.claim.sub','00000000-0000-0000-00ee-000000000001',true);
do $$
declare s record; a numeric; b numeric; payload jsonb;
begin
 for s in select * from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) loop
  assert abs(s.want_pct-1000.0/14)<0.000000001, format('Want share %s',s.want_pct);
  assert abs(s.unwanted_pct-400.0/14)<0.000000001, 'unwanted share';
  assert abs(s.utility-800.0/14)<0.000000001, 'utility';
  assert s.friend_voters=14 and s.friend_bin='5+', 'friend-data count';
 end loop;
 select want_pct into a from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 update public.preferences set top=true where user_id=auth.uid() and line_id='pikachu';
 select want_pct into b from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert a=b,'Spotlight changed the mix';
 select to_jsonb(r) into payload from public.browse_all() r where user_id='00000000-0000-0000-00ee-000000000002';
 assert payload is not null and (payload->>'good')::boolean, 'positive pair must qualify';
 assert not payload ?| array['match_pct','they_unwanted_pct','they_utility','both_pct','baseline_utility','lift','voted','fit_wants','fit_dont_wants'], 'hidden direction leaked';
 assert abs((payload->>'you_utility')::numeric-800.0/14)<0.000000001,'wrong public own utility';
 select to_jsonb(r) into payload from public.browse_players('you_fit',true,50,0,107) r where user_id='00000000-0000-0000-00ee-000000000002';
 assert not payload ?| array['match_pct','they_unwanted_pct','they_utility','both_pct'], 'paged endpoint leaked hidden fit';
 assert not exists(select 1 from public.trial_global_counts() c full join public.community_want_rate() r using(line_id)
   where c.line_id is null or r.line_id is null or abs(c.wants/c.voters-r.rate)>0.000000001), 'global blend population changed';
 -- Their private own votes change eligibility, never the viewer's shares.
 update public.preferences set choice='dont_want',top=false where user_id='00000000-0000-0000-00ee-000000000002';
 select to_jsonb(r) into payload from public.browse_all() r where user_id='00000000-0000-0000-00ee-000000000002';
 assert not (payload->>'good')::boolean,'nonpositive other utility qualified';
 assert abs((payload->>'you_fit_pct')::numeric-a)<0.000000001,'their private votes changed For you';
 update public.preferences set choice=case when line_id='eevee' then 'dont_want'::public.choice else 'want'::public.choice end
 where user_id='00000000-0000-0000-00ee-000000000002';
 -- Neutral-only saved votes are data, not a dash; missing votes are a dash.
 select * into s from public.trial_pair_scores('00000000-0000-0000-00ee-000000000004',array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert s.want_pct=0 and s.unwanted_pct=0 and s.utility=0,'Neutral must be 0, not null';
 select * into s from public.trial_pair_scores('00000000-0000-0000-00ee-000000000003',array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert s.want_pct is null and s.utility is null,'unsaved votes must be unknown';
 select * into s from public.trial_pair_scores('00000000-0000-0000-00ee-000000000005',array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert s.want_pct=0 and s.unwanted_pct>0 and s.utility<0,'negative utility lost';
 select * into s from public.trial_pair_scores('00000000-0000-0000-00ee-000000000006',array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert s.utility=0,'exactly twice as much unwanted must yield exactly zero utility';
 -- No sending estimate is distinct from a receiver's saved votes.
 select * into s from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000003'::uuid]) where direction='you';
 assert s.want_pct is null,'empty mix invented a fit';
 -- Adding another Want never lowers fit, and Wanting the whole mix is 100.
 select want_pct into a from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 update public.preferences set choice='want' where user_id=auth.uid() and line_id='eevee';
 select want_pct into b from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='you';
 assert b>=a and abs(b-100)<0.000000001,'broad Wants penalized';
 update public.preferences set choice='dont_want' where user_id=auth.uid() and line_id='eevee';
end $$;

-- A real global prior, exact baseline/lift, and newcomer behavior.
create or replace function public.demand_prior_votes() returns numeric language sql immutable as $$ select 5::numeric $$;
do $$
declare s record; expected numeric; payload jsonb; ids uuid[]; n int;
begin
 select * into s from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000003'::uuid]) where direction='you';
 assert s.friend_voters=0 and s.friend_bin='0' and s.utility is not null and abs(s.lift)<0.000000001,'zero friends must use global baseline';
 select sum(d.share*100) filter(where p.choice='want') into expected
 from public.group_demand(auth.uid()) d left join public.preferences p on p.user_id='00000000-0000-0000-00ee-000000000002' and p.line_id=d.line_id;
 select * into s from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000002'::uuid]) where direction='them';
 assert abs(s.want_pct-coalesce(expected,0))<0.000000001,'batch and rate-aware helper disagree';
 assert abs(s.lift-(s.utility-s.baseline_utility))<0.000000001,'lift is not utility points';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00ee-000000000003',true);
 assert not exists(select 1 from public.browse_all() where good),'newcomer qualified using only hidden direction';
 assert exists(select 1 from public.browse_all()),'newcomer cannot browse All players';
 assert not exists(select 1 from public.browse_all() where you_fit_pct is not null or you_voted),'newcomer got invented For you';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00ee-000000000001',true);
 assert not exists(select 1 from public.lookup_players('Trial 02') where match_pct is not null or they_unwanted_pct is not null or they_utility is not null),'lookup leaked private direction';
end $$;
-- One voting friend: 1–4 bin. Skip the receiver when they are already friends.
insert into public.friends(user_id,friend_id) values
('00000000-0000-0000-00ee-000000000003','00000000-0000-0000-00ee-000000000011');
do $$ declare s record; begin
 select * into s from public.trial_pair_scores(auth.uid(),array['00000000-0000-0000-00ee-000000000003'::uuid]) where direction='you';
 assert s.friend_voters=1 and s.friend_bin='1–4','small-data bin';
end $$;
-- Requests see only the recipient's own shares, while mutual friends see both.
insert into public.friend_requests(from_id,to_id) values ('00000000-0000-0000-00ee-000000000002','00000000-0000-0000-00ee-000000000001');
do $$ declare payload jsonb; begin
 select to_jsonb(r) into payload from public.get_friend_requests(true) r where user_id='00000000-0000-0000-00ee-000000000002';
 assert payload is not null and payload->>'you_fit_pct' is not null,'request lost recipient fit';
 assert not payload ?| array['match_pct','they_unwanted_pct','they_utility'],'request exposed requester private fit';
end $$;
select public.test_befriend('00000000-0000-0000-00ee-000000000001','00000000-0000-0000-00ee-000000000002');
do $$ declare f record; u record; t record; begin
 select * into f from public.get_friends() where user_id='00000000-0000-0000-00ee-000000000002';
 select * into u from public.trial_pair_scores(auth.uid(),array[f.user_id]) where direction='you';
 select * into t from public.trial_pair_scores(auth.uid(),array[f.user_id]) where direction='them';
 assert f.you_fit_pct=u.want_pct and f.match_pct=t.want_pct and f.you_unwanted_pct=u.unwanted_pct and f.they_unwanted_pct=t.unwanted_pct,'friends do not match common batch';
 assert u.friend_voters=14 and t.friend_voters=14,'receiver counted as own sender demand';
 assert not exists(select 1 from public.browse_all() where user_id=f.user_id),'existing friend suggested';
 assert not exists(select 1 from public.get_friends(false) where you_fit_pct is not null or match_pct is not null),'disabled score option ignored';
end $$;

-- Eligibility gates and actual API-role enforcement on the final schema.
update public.profiles set open_to_friends=false where id='00000000-0000-0000-00ee-000000000003';
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'closed player suggested'; end $$;
update public.profiles set open_to_friends=true,last_seen_at=now()-interval '3 months' where id='00000000-0000-0000-00ee-000000000003';
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'inactive player suggested'; end $$;
update public.profiles set last_seen_at=now(),allow_lookup=false where id='00000000-0000-0000-00ee-000000000003';
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'unsearchable player suggested'; end $$;
update public.profiles set allow_lookup=true,game_avatar=null where id='00000000-0000-0000-00ee-000000000003';
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'missing identity suggested'; end $$;
update public.profiles set game_avatar='pikachu:normal' where id='00000000-0000-0000-00ee-000000000003';
-- Capacity and inactive reports retain their original eligibility behavior.
insert into auth.users(id,raw_user_meta_data)
select ('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('name','trial_capacity_'||n)
from generate_series(25,73) n;
insert into public.friends(user_id,friend_id)
select '00000000-0000-0000-00ee-000000000003'::uuid,('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid
from generate_series(25,73) n;
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'full player suggested'; end $$;
delete from public.friends where user_id='00000000-0000-0000-00ee-000000000003' and friend_id>='00000000-0000-0000-00ee-000000000025';
insert into public.inactive_reports(reporter_id,player_id,created_at) values
('00000000-0000-0000-00ee-000000000001','00000000-0000-0000-00ee-000000000003',now()+interval '1 second');
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'own inactive report ignored'; end $$;
delete from public.inactive_reports where reporter_id=auth.uid() and player_id='00000000-0000-0000-00ee-000000000003';
insert into public.inactive_reports(reporter_id,player_id,created_at)
select ('00000000-0000-0000-00ee-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-00ee-000000000003'::uuid,now()+interval '1 second'
from generate_series(25,24+public.inactive_reports_to_hide()) n;
do $$ begin assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'community inactive reports ignored'; end $$;
delete from public.inactive_reports where player_id='00000000-0000-0000-00ee-000000000003';
insert into public.blocks(blocker_id,blocked_id) values ('00000000-0000-0000-00ee-000000000003','00000000-0000-0000-00ee-000000000001');
set local role authenticated;
do $$ begin
 assert not exists(select 1 from public.browse_all() where user_id='00000000-0000-0000-00ee-000000000003'),'reverse block ignored';
 assert exists(select 1 from public.get_friends()),'authenticated friend endpoint failed';
 begin perform * from public.trial_pair_scores(auth.uid(),'{}'); raise exception 'private scores exposed'; exception when insufficient_privilege then null; end;
 begin perform * from public.match_trial_diagnostics(array[auth.uid()]); raise exception 'diagnostics exposed'; exception when insufficient_privilege then null; end;
 begin perform * from public.get_matches(); raise exception 'legacy match API exposed'; exception when insufficient_privilege then null; end;
 begin perform * from public.trial_friend_contacts(true); raise exception 'old score endpoint exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 assert exists(select 1 from public.match_trial_diagnostics(array[auth.uid()]) where scored>0),'admin diagnostics missing';
 assert not has_function_privilege('anon','public.browse_all()','execute'),'anonymous suggestions exposed';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and has_function_privilege('authenticated',p.oid,'execute')
   and p.prosrc ~ '\m(fit_pct|you_fit_pct|group_demand|trial_pair_scores)\M'
   and p.proname not in ('browse_all','browse_candidate_batch','get_friends','get_friend_requests','lookup_players')), 'unreviewed match-score API remains executable';
end $$;
rollback;
\echo 'EXPECTED CANDY FIT TRIAL CONTRACT AND PRIVACY TESTS PASSED'
