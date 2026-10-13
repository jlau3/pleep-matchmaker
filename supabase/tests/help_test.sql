\set ON_ERROR_STOP on

-- help_seen_version: starts at 0, and players can update their own and nobody else's.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0006-000000000001', '{"name":"helpme#0"}'),
  ('00000000-0000-0000-0006-000000000002', '{"name":"other#0"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0006-000000000001', false);
do $$ begin
  assert (select help_seen_version from public.profiles where id = auth.uid()) = 0, 'starts unseen';
end $$;
update public.profiles set help_seen_version = 1 where id = auth.uid();
update public.profiles set help_seen_version = 1 where id = '00000000-0000-0000-0006-000000000002'; -- RLS: no row
reset role;
do $$ begin
  assert (select help_seen_version from public.profiles where discord_username = 'helpme') = 1, 'own update';
  assert (select help_seen_version from public.profiles where discord_username = 'other') = 0, 'others untouched';
end $$;

\echo 'ALL HELP TESTS PASSED'
