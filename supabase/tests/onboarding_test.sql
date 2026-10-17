\set ON_ERROR_STOP on

-- 20261021000000_onboarding.sql: new players start with both flags off,
-- the backfill marks players with friends / votes, and players can set their
-- own flags and nobody else's.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0031-000000000001', '{"name":"onb_new#0"}'),
  ('00000000-0000-0000-0031-000000000002', '{"name":"onb_old#0"}'),
  ('00000000-0000-0000-0031-000000000003', '{"name":"onb_pal#0"}');
select public.test_befriend('00000000-0000-0000-0031-000000000002', '00000000-0000-0000-0031-000000000003');
insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0031-000000000002', 'pikachu', 'want'),
  ('00000000-0000-0000-0031-000000000003', 'pikachu', 'undecided');

-- Re-run the backfill as if the columns were new.
alter table public.profiles drop column setup_done, drop column vote_guide_seen;
\ir ../migrations/20261021000000_onboarding.sql

do $$ begin
  assert (select not setup_done and not vote_guide_seen from public.profiles where id = '00000000-0000-0000-0031-000000000001'), 'new player: both off';
  assert (select setup_done and vote_guide_seen from public.profiles where id = '00000000-0000-0000-0031-000000000002'), 'friend and a vote: both on';
  assert (select setup_done and not vote_guide_seen from public.profiles where id = '00000000-0000-0000-0031-000000000003'), 'Neutral only is not a vote';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0031-000000000001', false);
update public.profiles set setup_done = true, vote_guide_seen = true where id = auth.uid();
update public.profiles set setup_done = false, vote_guide_seen = false where id = '00000000-0000-0000-0031-000000000002'; -- RLS: no row
reset role;
do $$ begin
  assert (select setup_done and vote_guide_seen from public.profiles where id = '00000000-0000-0000-0031-000000000001'), 'own update';
  assert (select setup_done and vote_guide_seen from public.profiles where id = '00000000-0000-0000-0031-000000000002'), 'others untouched';
end $$;

\echo 'ALL ONBOARDING TESTS PASSED'
