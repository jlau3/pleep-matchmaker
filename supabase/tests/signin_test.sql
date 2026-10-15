\set ON_ERROR_STOP on

-- Only Discord sign-ins fill the discord_* fields and avatar.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0007-000000000001',
   '{"iss":"https://discord.com/api","provider_id":"77","name":"dizzy#0","custom_claims":{"global_name":"Dizzy"},"avatar_url":"https://cdn.discordapp.com/a.png"}'),
  ('00000000-0000-0000-0007-000000000002',
   '{"iss":"https://accounts.google.com","provider_id":"1234567890","name":"Jane Realname","full_name":"Jane Realname","avatar_url":"https://lh3.googleusercontent.com/me.jpg","email":"jane@example.com"}'),
  ('00000000-0000-0000-0007-000000000003',
   '{"email":"anon@example.com","email_verified":true,"sub":"00000000-0000-0000-0007-000000000003"}');

do $$
declare r record;
begin
  select * into r from public.profiles where id = '00000000-0000-0000-0007-000000000001';
  assert r.discord_username = 'dizzy' and r.discord_display_name = 'Dizzy' and r.discord_id = '77', 'discord synced';
  assert r.avatar_url is not null, 'discord avatar';
  assert r.show_discord, 'discord sign-up shows the name by default';

  select * into r from public.profiles where id = '00000000-0000-0000-0007-000000000002';
  assert found, 'google user gets a profile';
  assert r.discord_username is null and r.discord_display_name is null and r.discord_id is null, 'no google name';
  assert r.avatar_url is null, 'no google photo';
  assert not r.show_discord, 'google sign-up: off';

  select * into r from public.profiles where id = '00000000-0000-0000-0007-000000000003';
  assert found and r.discord_username is null and r.avatar_url is null and not r.show_discord, 'email user: empty profile, off';
end $$;

-- Signing in to a Discord account with Google later doesn't overwrite it.
update auth.users
set raw_user_meta_data = '{"iss":"https://accounts.google.com","provider_id":"999","name":"Dee Realname","avatar_url":"https://lh3.googleusercontent.com/x.jpg"}'
where id = '00000000-0000-0000-0007-000000000001';
do $$ begin
  assert (select discord_username from public.profiles where id = '00000000-0000-0000-0007-000000000001') = 'dizzy', 'discord name kept';
  assert (select show_discord from public.profiles where id = '00000000-0000-0000-0007-000000000001'), 'setting untouched by later logins';
  assert (select avatar_url from public.profiles where id = '00000000-0000-0000-0007-000000000001') like '%discordapp%', 'discord avatar kept';
end $$;

-- Turned off, it stays off through later Discord logins (only the first sign-up sets it).
update public.profiles set show_discord = false where id = '00000000-0000-0000-0007-000000000001';
update auth.users
set raw_user_meta_data = '{"iss":"https://discord.com/api","provider_id":"77","name":"dizzy#0","custom_claims":{"global_name":"Dizzy 2"}}'
where id = '00000000-0000-0000-0007-000000000001';
do $$ begin
  assert not (select show_discord from public.profiles where id = '00000000-0000-0000-0007-000000000001'), 'choice kept on re-login';
  assert (select discord_display_name from public.profiles where id = '00000000-0000-0000-0007-000000000001') = 'Dizzy 2', 'name still synced';
end $$;

-- A Google/email player is found by IGN.
update public.profiles set ign = 'JaneSleeps' where id = '00000000-0000-0000-0007-000000000002';
-- Searching needs your own IGN (20261021000300_search_needs_ign.sql).
update public.profiles set ign = coalesce(ign, 'ZzSearcher003'), friend_code = coalesce(friend_code, '420007003000') where id = '00000000-0000-0000-0007-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0007-000000000003', false);
do $$ begin
  assert (select count(*) from public.lookup_players('janesleeps')) = 1, 'found by IGN';
  assert not exists (select 1 from public.lookup_players('Jane Realname')), 'not by real name';
end $$;
reset role;

\echo 'ALL SIGN-IN TESTS PASSED'
