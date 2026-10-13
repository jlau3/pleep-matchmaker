\set ON_ERROR_STOP on

-- New accounts start with the Discord name hidden: others see the IGN only,
-- and can't find them by Discord name.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-000b-000000000001', '{"iss":"https://discord.com/api","provider_id":"91","name":"shy#0","custom_claims":{"global_name":"Shy"},"avatar_url":"https://cdn.discordapp.com/s.png"}'),
  ('00000000-0000-0000-000b-000000000002', '{"iss":"https://discord.com/api","provider_id":"92","name":"viewer#0"}');
update public.profiles set ign = 'ShySleeper', friend_code = '999900000001' where discord_username = 'shy';
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-000b-000000000001', '00000000-0000-0000-000b-000000000002']) u,
     unnest(array['sa', 'sb', 'sc']) l;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000b-000000000002', false);
do $$
declare r record;
begin
  assert (select show_discord from public.profiles where id = auth.uid()) = false, 'new accounts start hidden';
  assert not exists (select 1 from public.lookup_players('shy')), 'not found by hidden Discord name';
  assert not exists (select 1 from public.lookup_players('Shy')), 'not found by hidden display name';
  select * into r from public.lookup_players('ShySleeper');
  assert found and r.discord_username is null and r.discord_display_name is null and r.avatar_url is null, 'lookup masked';
  select * into r from public.get_matches() where user_id = '00000000-0000-0000-000b-000000000001';
  assert found and r.discord_username is null and r.avatar_url is null, 'match masked';
end $$;

insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-000b-000000000001');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-000b-000000000001');
do $$ begin
  assert (select ign from public.get_blocked()) = 'ShySleeper', 'blocked list has IGN';
  assert (select discord_username from public.get_blocked()) is null, 'blocked list masked';
end $$;
delete from public.blocks where blocker_id = auth.uid();
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-000b-000000000001');
do $$ begin
  assert (select discord_username from public.get_friends()) is null, 'friend masked';
end $$;

-- Turning it on shows the name everywhere and makes it searchable.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000b-000000000001', false);
update public.profiles set show_discord = true where id = auth.uid();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000b-000000000002', false);
do $$ begin
  assert (select discord_username from public.lookup_players('shy')) = 'shy', 'found by Discord name once shown';
  assert (select avatar_url from public.get_friends()) is not null, 'avatar shown';
end $$;

-- Players can't flip someone else's setting.
update public.profiles set show_discord = false where id = '00000000-0000-0000-000b-000000000001';
reset role;
do $$ begin
  assert (select show_discord from public.profiles where id = '00000000-0000-0000-000b-000000000001'), 'others untouched';
end $$;

\echo 'ALL SHOW DISCORD TESTS PASSED'
