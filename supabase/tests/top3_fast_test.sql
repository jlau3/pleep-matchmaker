\set ON_ERROR_STOP on

-- 20261020000000_top3_fast.sql: top3_tiers_set gives, for many players at
-- once, exactly what one list_tiers per player gives (the dash rule on top).
-- Random lists: 40 players, random friendships and votes on 12 lines of 15.
select setseed(0.24);
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0024-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 't3f' || g || '#0')
from generate_series(1, 40) g;
update public.profiles set allow_lookup = false where id = '00000000-0000-0000-0024-000000000040';
insert into public.preferences (user_id, line_id, choice, top)
select ('00000000-0000-0000-0024-' || lpad(g::text, 12, '0'))::uuid, 'tf' || l,
  (array['want', 'want', 'dont_want', 'undecided'])[1 + floor(random() * 4)::int]::public.choice, false
from generate_series(2, 40) g, generate_series(1, 12) l
where random() < 0.5;
-- The viewer (1) stars tf1..tf3 and is friends with a few of them too.
insert into public.preferences (user_id, line_id, choice, top) values
  ('00000000-0000-0000-0024-000000000001', 'tf1', 'want', true),
  ('00000000-0000-0000-0024-000000000001', 'tf2', 'want', true),
  ('00000000-0000-0000-0024-000000000001', 'tf3', 'want', true);
select public.test_befriend(('00000000-0000-0000-0024-' || lpad(a::text, 12, '0'))::uuid, ('00000000-0000-0000-0024-' || lpad(b::text, 12, '0'))::uuid)
from generate_series(1, 40) a, generate_series(1, 40) b
where a < b and random() < 0.3;

do $$
declare
  viewer uuid := '00000000-0000-0000-0024-000000000001';
  everyone uuid[] := array(select ('00000000-0000-0000-0024-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 40) g);
  got text[];
  want text[];
begin
  select array_agg(t.user_id || ':' || t.line_id || ':' || t.tier order by t.user_id, t.line_id) into got
  from public.top3_tiers_set(everyone, viewer, 15) t;
  -- Reference: each player's list_tiers, a tier only when 3+ friends besides
  -- the viewer want something and one of them wants that line (20261019000300);
  -- Avoid shows as a dash too (20261020000900).
  select array_agg(x order by x) into want from (
    select pl.id || ':' || p.line_id || ':' || lt.tier as x
    from unnest(everyone) pl(id)
    cross join public.preferences p
    cross join lateral public.list_tiers(pl.id, 15) lt
    where p.user_id = viewer and p.top and lt.line_id = p.line_id and lt.tier <> 'Avoid'
      and (
        select count(*) from public.friends f
        join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
        where f.user_id = pl.id and f.friend_id <> viewer
          and exists (select 1 from public.preferences w where w.user_id = f.friend_id and w.choice = 'want')
      ) >= 3
      and exists (
        select 1 from public.friends f
        join public.profiles fp on fp.id = f.friend_id and fp.allow_lookup
        join public.preferences w on w.user_id = f.friend_id and w.line_id = p.line_id and w.choice = 'want'
        where f.user_id = pl.id and f.friend_id <> viewer
      )
  ) r;
  assert cardinality(want) > 20, format('enough cases to compare: %s', cardinality(want));
  assert got = want, format('set and per-player agree: %s', (select array_agg(e) from unnest(got) e where e <> all(want)));
  assert (select count(distinct tier) from public.top3_tiers_set(everyone, viewer, 15)) >= 3, 'several tiers covered';
  assert not exists (select 1 from public.top3_tiers_set(everyone, '00000000-0000-0000-0024-000000000002', 15)),
    'no Top 3, nothing';
end $$;

\echo 'ALL TOP 3 FAST TESTS PASSED'
