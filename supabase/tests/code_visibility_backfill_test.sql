\set ON_ERROR_STOP on

-- 20261021000800_code_visibility.sql backfill: share_code off, or closed to
-- new friends, becomes 'friends'; everyone else 'matches'. share_code goes.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0036-000000000001', '{"name":"cvb_open#0"}'),
  ('00000000-0000-0000-0036-000000000002', '{"name":"cvb_hidden#0"}'),
  ('00000000-0000-0000-0036-000000000003', '{"name":"cvb_closed#0"}');
alter table public.profiles drop column code_visibility;
alter table public.profiles add column share_code boolean not null default true;
update public.profiles set share_code = false where id = '00000000-0000-0000-0036-000000000002';
update public.profiles set open_to_friends = false where id = '00000000-0000-0000-0036-000000000003';
\ir ../migrations/20261021000800_code_visibility.sql
do $$ begin
  assert (select code_visibility from public.profiles where id = '00000000-0000-0000-0036-000000000001') = 'matches', 'open: matches';
  assert (select code_visibility from public.profiles where id = '00000000-0000-0000-0036-000000000002') = 'friends', 'share_code off: friends';
  assert (select code_visibility from public.profiles where id = '00000000-0000-0000-0036-000000000003') = 'friends', 'closed: friends';
  assert not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'share_code'), 'share_code dropped';
end $$;

\echo 'ALL CODE VISIBILITY BACKFILL TESTS PASSED'
