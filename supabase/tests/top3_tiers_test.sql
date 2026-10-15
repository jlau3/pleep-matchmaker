\set ON_ERROR_STOP on

-- 20261019000200_top3_sort.sql: list_tiers must match src/lib/tiers.ts
-- (buildTiers). Expected tiers below were computed with buildTiers for the same
-- votes: 4 voters; per line (wants, don't-wants) q1 4,0  q2 3,0  q3 2,1  q4 1,0
-- q5 0,2  q6 2,0  q7 1,1  q8 0,1; the rest unvoted ('' in list_tiers).
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0023-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'tt' || g || '#0')
from generate_series(1, 6) g;
-- 1 player, 2-5 their friends, 6 viewer.
select public.test_befriend('00000000-0000-0000-0023-000000000001', ('00000000-0000-0000-0023-' || lpad(g::text, 12, '0'))::uuid)
from generate_series(2, 5) g;
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0023-' || lpad(f::text, 12, '0'))::uuid, l, c::public.choice
from (values
  (2, 'q1', 'want'), (3, 'q1', 'want'), (4, 'q1', 'want'), (5, 'q1', 'want'),
  (2, 'q2', 'want'), (3, 'q2', 'want'), (4, 'q2', 'want'),
  (2, 'q3', 'want'), (3, 'q3', 'want'), (4, 'q3', 'dont_want'),
  (2, 'q4', 'want'),
  (2, 'q5', 'dont_want'), (3, 'q5', 'dont_want'),
  (4, 'q6', 'want'), (5, 'q6', 'want'),
  (5, 'q7', 'want'), (4, 'q7', 'dont_want'),
  (3, 'q8', 'dont_want')
) v(f, l, c);

do $$
declare
  got jsonb;
  p constant uuid := '00000000-0000-0000-0023-000000000001';
begin
  select jsonb_object_agg(line_id, tier) into got from public.list_tiers(p, 20);
  assert got = '{"q1":"S","q2":"S","q6":"S","q4":"S","":"B","q3":"B","q7":"C","q8":"C","q5":"Avoid"}', format('20 lines: %s', got);
  select jsonb_object_agg(line_id, tier) into got from public.list_tiers(p, 10);
  assert got = '{"q1":"S","q2":"S","q6":"A","q4":"A","":"B","q3":"B","q7":"C","q8":"C","q5":"Avoid"}', format('10 lines: %s', got);
  select jsonb_object_agg(line_id, tier) into got from public.list_tiers(p, 8);
  assert got = '{"q1":"S","q2":"S","q6":"A","q4":"A","q3":"B","q7":"B","q8":"C","q5":"Avoid"}', format('8 lines: %s', got);
  assert not exists (select 1 from public.list_tiers('00000000-0000-0000-0023-000000000006', 20)), 'no friends voting: no list';
end $$;

-- The viewer stars q6, q8 and an unvoted line. Only q6 is wanted by the
-- player's friends (4 of whom want something): it gets its tier, the others
-- Avoid (20261020001000_top3_avoid.sql): unlikely from this player.
insert into public.preferences (user_id, line_id, choice, top) values
  ('00000000-0000-0000-0023-000000000006', 'q6', 'want', true),
  ('00000000-0000-0000-0023-000000000006', 'q8', 'want', true),
  ('00000000-0000-0000-0023-000000000006', 'u9', 'want', true);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0023-000000000006', false);
do $$
declare got jsonb;
begin
  select jsonb_object_agg(line_id, tier) into got
  from public.top3_tiers(array['00000000-0000-0000-0023-000000000001'::uuid], 10);
  assert got = '{"q6":"A","q8":"Avoid","u9":"Avoid"}', format('card tiers: %s', got);
end $$;
reset role;

-- Fewer than 3 friends wanting anything: no list, so no rows (the app hides the row).
reset role;
delete from public.friends where user_id = '00000000-0000-0000-0023-000000000001'
  and friend_id in ('00000000-0000-0000-0023-000000000004', '00000000-0000-0000-0023-000000000005');
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.top3_tiers(array['00000000-0000-0000-0023-000000000001'::uuid], 10)),
    'two voting friends: no list for your Top 3';
end $$;
reset role;

\echo 'ALL TOP 3 TIER TESTS PASSED'
