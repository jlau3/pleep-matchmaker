\set ON_ERROR_STOP on

-- meta_seen_id: starts empty, and players can update their own and nobody else's.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-000e-000000000001', '{"name":"ms_reader#0"}'),
  ('00000000-0000-0000-000e-000000000002', '{"name":"ms_other#0"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000e-000000000001', false);
do $$ begin
  assert (select meta_seen_id from public.profiles where id = auth.uid()) is null, 'starts unseen';
end $$;
update public.profiles set meta_seen_id = '2026-11-darkrai' where id = auth.uid();
update public.profiles set meta_seen_id = '2026-11-darkrai' where id = '00000000-0000-0000-000e-000000000002'; -- RLS: no row
reset role;
do $$ begin
  assert (select meta_seen_id from public.profiles where discord_username = 'ms_reader') = '2026-11-darkrai', 'own update';
  assert (select meta_seen_id from public.profiles where discord_username = 'ms_other') is null, 'others untouched';
end $$;

\echo 'ALL META SEEN TESTS PASSED'
