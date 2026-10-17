-- Only loaded by test-db.sh, in an isolated database cloned from the trial.
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','{}');
update public.profiles set ign='Seed Tester',friend_code='123456789012',game_avatar='pikachu:normal'
where id='00000000-0000-4000-8000-000000000001';
insert into public.preferences(user_id,line_id,choice)
select '00000000-0000-4000-8000-000000000001',line_id,
 case when n<6 then 'want' else 'dont_want' end::public.choice
from unnest(array['pikachu','bulbasaur','chikorita','eevee','bagon','dratini',
 'snover','quaxly','doduo','drifloon','psyduck','pinsir']) with ordinality l(line_id,n);
select public.test_befriend('00000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000141');
insert into public.friend_requests(from_id,to_id) values
 ('00000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000142'),
 ('de000000-0000-4000-8000-000000000143','00000000-0000-4000-8000-000000000001');

create table seed_preserved as
select 'profile' kind,to_jsonb(p) data from public.profiles p
where id::text not like 'de000000-0000-4000-8000-%' or id<='de000000-0000-4000-8000-000000000020'
union all select 'vote',to_jsonb(p) from public.preferences p
where user_id::text not like 'de000000-0000-4000-8000-%' or user_id<='de000000-0000-4000-8000-000000000020'
union all select 'friend',to_jsonb(f) from public.friends f
where user_id::text not like 'de000000-0000-4000-8000-%' or friend_id::text not like 'de000000-0000-4000-8000-%'
 or user_id<='de000000-0000-4000-8000-000000000020' or friend_id<='de000000-0000-4000-8000-000000000020'
union all select 'request',to_jsonb(r) from public.friend_requests r;
