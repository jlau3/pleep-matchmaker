\set ON_ERROR_STOP on

-- 20261020000200_line_seen.sql: per line, the active voters who've seen it.
-- Three voters have Neutral on ls_old, one wants it; only two have ls_new; a
-- player with nothing but Neutral votes isn't a voter and doesn't count.
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0025-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'ls' || g || '#0')
from generate_series(1, 5) g;
insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0025-000000000001', 'ls_old', 'want'),
  ('00000000-0000-0000-0025-000000000002', 'ls_old', 'undecided'),
  ('00000000-0000-0000-0025-000000000002', 'ls_any', 'dont_want'),
  ('00000000-0000-0000-0025-000000000003', 'ls_old', 'undecided'),
  ('00000000-0000-0000-0025-000000000003', 'ls_any', 'want'),
  ('00000000-0000-0000-0025-000000000001', 'ls_new', 'want'),
  ('00000000-0000-0000-0025-000000000002', 'ls_new', 'undecided'),
  ('00000000-0000-0000-0025-000000000004', 'ls_old', 'undecided'),
  ('00000000-0000-0000-0025-000000000004', 'ls_new', 'undecided');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0025-000000000001', false);
do $$ begin
  assert (select seen from public.get_line_stats() where line_id = 'ls_old') = 3, 'three voters have seen ls_old';
  assert (select wants from public.get_line_stats() where line_id = 'ls_old') = 1, 'one wants it';
  assert (select seen from public.get_line_stats() where line_id = 'ls_new') = 2, 'only two have seen ls_new (4 is no voter)';
end $$;
reset role;

\echo 'ALL LINE SEEN TESTS PASSED'
