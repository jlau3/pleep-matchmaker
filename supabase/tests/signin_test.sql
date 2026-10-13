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

  select * into r from public.profiles where id = '00000000-0000-0000-0007-000000000002';
  assert found, 'google user gets a profile';
  assert r.discord_username is null and r.discord_display_name is null and r.discord_id is null, 'no google name';
  assert r.avatar_url is null, 'no google photo';

  select * into r from public.profiles where id = '00000000-0000-0000-0007-000000000003';
  assert found and r.discord_username is null and r.avatar_url is null, 'email user: empty profile';
end $$;

-- Signing in to a Discord account with Google later doesn't overwrite it.
update auth.users
set raw_user_meta_data = '{"iss":"https://accounts.google.com","provider_id":"999","name":"Dee Realname","avatar_url":"https://lh3.googleusercontent.com/x.jpg"}'
where id = '00000000-0000-0000-0007-000000000001';
do $$ begin
  assert (select discord_username from public.profiles where id = '00000000-0000-0000-0007-000000000001') = 'dizzy', 'discord name kept';
  assert (select avatar_url from public.profiles where id = '00000000-0000-0000-0007-000000000001') like '%discordapp%', 'discord avatar kept';
end $$;

-- A Google/email player is found by IGN.
update public.profiles set ign = 'JaneSleeps' where id = '00000000-0000-0000-0007-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0007-000000000003', false);
do $$ begin
  assert (select count(*) from public.lookup_players('janesleeps')) = 1, 'found by IGN';
  assert not exists (select 1 from public.lookup_players('Jane Realname')), 'not by real name';
end $$;
reset role;

\echo 'ALL SIGN-IN TESTS PASSED'
