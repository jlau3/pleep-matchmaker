begin;
-- Run the same end-state rules on incremental dev and the standalone squash.
\ir ../migrations/20261026001100_align_friend_tiers.sql
\ir ../migrations/20261026001200_bounded_candidate_batches.sql
insert into auth.users(id,raw_user_meta_data)
select ('00000000-0000-4000-00fa-'||lpad(n::text,12,'0'))::uuid,'{}'::jsonb from generate_series(1,1118)n;
update public.profiles set ign='Final '||right(id::text,4),friend_code='7800'||right(id::text,8),game_avatar='pikachu:normal',
 open_to_friends=true,allow_lookup=true,last_seen_at=now(),created_at=now()
where id::text like '00000000-0000-4000-00fa-%';
-- Viewer 1; owner 2 has ten voting friends (3..12), nine Neutral-only.
select public.test_befriend('00000000-0000-4000-00fa-000000000002',('00000000-0000-4000-00fa-'||lpad(n::text,12,'0'))::uuid) from generate_series(3,12)n;
insert into public.preferences(user_id,line_id,choice)
select ('00000000-0000-4000-00fa-'||lpad(n::text,12,'0'))::uuid,'x',case when n=3 then 'want' else 'undecided' end::public.choice from generate_series(3,12)n;
insert into public.preferences(user_id,line_id,choice) values ('00000000-0000-4000-00fa-000000000003','negative','dont_want');
insert into public.preferences(user_id,line_id,choice,top) values
 ('00000000-0000-4000-00fa-000000000001','x','want',true),
 ('00000000-0000-4000-00fa-000000000001','zero','want',true),
 ('00000000-0000-4000-00fa-000000000001','negative','want',true);
-- Owner 13: one Neutral-only voting friend. Owner 15: only unsaved friend.
select public.test_befriend('00000000-0000-4000-00fa-000000000013','00000000-0000-4000-00fa-000000000014');
select public.test_befriend('00000000-0000-4000-00fa-000000000015','00000000-0000-4000-00fa-000000000016');
insert into public.preferences(user_id,line_id,choice) values ('00000000-0000-4000-00fa-000000000014','x','undecided');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00fa-000000000001',true);
do $$ declare got jsonb; begin
 select jsonb_object_agg(line_id,tier) into got from public.top3_tiers(array['00000000-0000-4000-00fa-000000000002'::uuid],3);
 assert got='{"x":"S","zero":"C","negative":"Avoid"}',format('badge mismatch with actual tiers: %s',got);

 select jsonb_object_agg(line_id,tier) into got from public.top3_tiers(array['00000000-0000-4000-00fa-000000000013'::uuid],3);
 assert got='{"x":"C","zero":"C","negative":"C"}',format('one Neutral voter must produce C, not dashes: %s',got);
 assert not exists(select 1 from public.top3_tiers(array['00000000-0000-4000-00fa-000000000015'::uuid],3)),'unsaved friends invented a list';
 assert not has_function_privilege('anon','public.get_friend_voters()','execute'),'anonymous friend metadata';
 assert not has_function_privilege('anon','public.browse_candidate_batch(uuid,integer)','execute'),'anonymous suggestions';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00fa-000000000002',true);
do $$ begin assert (select count(*) from public.get_friend_voters())=10,'Neutral-only friends excluded'; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00fa-000000000015',true);
do $$ begin assert not exists(select 1 from public.get_friend_voters()),'unsaved friend counted'; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-00fa-000000000001',true);
-- A hidden, blocked, or unavailable candidate must not return through batching.
reset role;
do $$ begin
 assert not exists(
   select 1 from public.top3_tiers(array['00000000-0000-4000-00fa-000000000002'::uuid],3)t
   where t.tier is distinct from coalesce(
     (select l.tier from public.list_tiers('00000000-0000-4000-00fa-000000000002',3)l where l.line_id=t.line_id),
     (select l.tier from public.list_tiers('00000000-0000-4000-00fa-000000000002',3)l where l.line_id=''))
 ),'Spotlight and actual Percentile tiers diverged';
end $$;
update public.profiles set allow_lookup=false where id='00000000-0000-4000-00fa-000000001117';
insert into public.blocks(blocker_id,blocked_id) values('00000000-0000-4000-00fa-000000000001','00000000-0000-4000-00fa-000000001118');
insert into public.friend_requests(from_id,to_id,status) values('00000000-0000-4000-00fa-000000000001','00000000-0000-4000-00fa-000000001116','declined');
set local role authenticated;
do $$ declare cursor_id uuid:=null; batch_count int; last_id uuid; collected uuid[]:='{}'; payload jsonb; begin
 loop
   select count(*), (array_agg(user_id order by user_id desc))[1],array_cat(collected,coalesce(array_agg(user_id),'{}'))
   into batch_count,last_id,collected from public.browse_candidate_batch(cursor_id,500);
   exit when batch_count=0;
   assert cursor_id is null or last_id>cursor_id,'cursor stuck';
   cursor_id:=last_id;
 end loop;
 assert (select count(distinct x) from unnest(collected)x)=cardinality(collected),'duplicate candidates';
 assert (select count(*) from unnest(collected)x where x::text like '00000000-0000-4000-00fa-%')=1115,'candidates after 1,000 missing or privacy gate lost';
 assert '00000000-0000-4000-00fa-000000001116'::uuid=any(collected),'tail beyond 1,000 absent';
 assert (select count(*) from public.browse_candidate_batch(null,5000))=500,'unbounded request';
 select to_jsonb(r) into payload from public.browse_candidate_batch('00000000-0000-4000-00fa-000000001115',500)r where user_id='00000000-0000-4000-00fa-000000001116';
 assert (payload->>'has_declined')::boolean and (payload->>'is_new')::boolean,'batch flags missing';
 assert not (payload ?| array['match_pct','they_utility','they_unwanted_pct','both_pct','they_voted']),'hidden direction leaked';
 assert (payload-'is_new'-'has_declined')=(select to_jsonb(r) from public.browse_all()r where user_id='00000000-0000-4000-00fa-000000001116'), 'batch changed scoring or contact/privacy contract';
end $$;
rollback;
\echo 'FINAL TIER ALIGNMENT AND BOUNDED CANDIDATE TESTS PASSED'
