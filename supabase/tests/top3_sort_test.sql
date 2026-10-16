\set ON_ERROR_STOP on

-- 20261019000200_top3_sort.sql: Find New's "Your Top 3" sort.
-- The viewer stars t3a and also wants t3b. Ann's three friends all want t3a
-- (S on her Tier List); Bob's want t3b, so t3a is lower on his; Cal has no
-- friends voting yet, so no list: last.
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0022-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 't3s' || g || '#0')
from generate_series(1, 10) g;
-- 1 viewer, 2 Ann, 3 Bob, 4 Cal; 5-7 Ann's friends, 8-10 Bob's.
update public.profiles set friend_code = '3300' || right(id::text, 8), ign = 'T3s' || right(id::text, 2) where id::text like '00000000-0000-0000-0022-%';
insert into public.preferences (user_id, line_id, choice, top) values
  ('00000000-0000-0000-0022-000000000001', 't3a', 'want', true),
  ('00000000-0000-0000-0022-000000000001', 't3b', 'want', false);
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0022-' || lpad(g::text, 12, '0'))::uuid, case when g <= 7 then 't3a' else 't3b' end, 'want'
from generate_series(5, 10) g;
select public.test_befriend('00000000-0000-0000-0022-000000000002', ('00000000-0000-0000-0022-' || lpad(g::text, 12, '0'))::uuid)
from generate_series(5, 7) g;
select public.test_befriend('00000000-0000-0000-0022-000000000003', ('00000000-0000-0000-0022-' || lpad(g::text, 12, '0'))::uuid)
from generate_series(8, 10) g;

-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0022-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0022-000000000001', false);
do $$
declare order_ids text[];
begin
  -- Every page (other tests leave plenty of players), in order.
  select array_agg(right(b.user_id::text, 1) order by pg.n, b.ordinality) into order_ids
  from generate_series(0, 9) pg(n)
  cross join lateral public.browse_players('top3', true, 50, pg.n * 50, 120) with ordinality as b
  where b.user_id in ('00000000-0000-0000-0022-000000000002', '00000000-0000-0000-0022-000000000003', '00000000-0000-0000-0022-000000000004');
  assert order_ids = '{2,3,4}', format('Ann (your Top 3 on her list), then Bob, then Cal with no list: %s', order_ids);
  -- Each card carries the tiers, whatever the sort (20261020000000_top3_fast.sql).
  assert (select b.top3_tiers from generate_series(0, 9) pg(n)
          cross join lateral public.browse_players('fit', true, 50, pg.n * 50, 120) b
          where b.user_id = '00000000-0000-0000-0022-000000000002') = '{"t3a": "S"}', 'Ann: S, on Best match too';
  assert exists (select 1 from generate_series(0, 9) pg(n)
          cross join lateral public.browse_players('fit', true, 50, pg.n * 50, 120) b
          where b.user_id = '00000000-0000-0000-0022-000000000004' and b.top3_tiers is null), 'Cal: dashes';
end $$;
reset role;

\echo 'ALL TOP 3 SORT TESTS PASSED'
