\set ON_ERROR_STOP on
begin;
-- Isolated players: both directions must retain the pre-optimization scores.
insert into auth.users(id, raw_user_meta_data)
select ('00000000-0000-0000-00cc-' || lpad(n::text,12,'0'))::uuid, jsonb_build_object('name','context_' || n)
from generate_series(1,5) n;
update public.profiles set ign = 'Context player', friend_code = '9000' || right(id::text,8), game_avatar = 'pikachu:normal'
where id::text like '00000000-0000-0000-00cc-%';
insert into public.preferences(user_id,line_id,choice)
select ('00000000-0000-0000-00cc-' || lpad(n::text,12,'0'))::uuid, 'bulbasaur', 'want'::public.choice
from generate_series(1,4) n;
insert into public.preferences(user_id,line_id,choice) values
('00000000-0000-0000-00cc-000000000001','charmander','dont_want'),
('00000000-0000-0000-00cc-000000000002','charmander','want');
insert into public.friends(user_id,friend_id) values
('00000000-0000-0000-00cc-000000000001','00000000-0000-0000-00cc-000000000002'),
('00000000-0000-0000-00cc-000000000002','00000000-0000-0000-00cc-000000000001'),
('00000000-0000-0000-00cc-000000000001','00000000-0000-0000-00cc-000000000003'),
('00000000-0000-0000-00cc-000000000003','00000000-0000-0000-00cc-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-0000-00cc-000000000001',true);
do $$
declare f record; rates jsonb;
begin
 select jsonb_object_agg(line_id,rate) into rates from public.community_want_rate();
 for f in select * from public.get_friends() loop
   assert f.match_pct is not distinct from public.fit_pct(auth.uid(),f.user_id), 'For them changed during batching';
   assert f.you_fit_pct is not distinct from public.you_fit_pct(auth.uid(),f.user_id), 'For you changed during batching';
 end loop;
 assert not exists(select 1 from public.get_friends(false) where match_pct is not null or you_fit_pct is not null), 'with_match=false must skip scores';
 assert (select you_source = 'Everyone estimate' and they_source = 'Friends + Everyone' and you_voted and they_voted
   from public.player_extras(array['00000000-0000-0000-00cc-000000000002'::uuid])), 'directional source or voting flags wrong';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00cc-000000000005',true);
 assert (select not you_voted from public.player_extras(array[auth.uid()])), 'missing own votes not reported';
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-00cc-000000000001',true);
 assert not has_function_privilege('authenticated','public.fit_pct_from_rates(uuid,uuid,jsonb)','execute'), 'private scoring helper exposed';
 assert not has_function_privilege('anon','public.player_extras(uuid[])','execute'), 'anonymous extras exposed';
end $$;
-- A candidate gains a voting friend other than the viewer; only For you's source changes.
insert into public.friends(user_id,friend_id) values
('00000000-0000-0000-00cc-000000000002','00000000-0000-0000-00cc-000000000004');
do $$ begin
 assert (select you_source = 'Friends + Everyone' from public.player_extras(array['00000000-0000-0000-00cc-000000000002'::uuid])), 'one real voter incorrectly labelled Everyone only';
end $$;
update public.profiles set votes_private=true where id='00000000-0000-0000-00cc-000000000005';
do $$ begin
 assert (select they_voted is null from public.player_extras(array['00000000-0000-0000-00cc-000000000005'::uuid])), 'private voting activity leaked';
end $$;
insert into public.blocks(blocker_id,blocked_id) values ('00000000-0000-0000-00cc-000000000001','00000000-0000-0000-00cc-000000000005');
do $$ begin
 assert not exists(select 1 from public.player_extras(array['00000000-0000-0000-00cc-000000000005'::uuid])), 'blocked context leaked';
end $$;
rollback;
