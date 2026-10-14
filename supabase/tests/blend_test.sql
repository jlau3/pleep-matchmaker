\set ON_ERROR_STOP on

-- Blending lists with the community (20261016000400_blend_with_community.sql).
-- The viewer wants six lines, a..f.
--   small: 3 friends who all want a, b, c and nothing else.
--   large: 12 friends; everyone wants a and b, half want c, d and z1..z3, a quarter e and f.
--   newbie: no friends and no votes yet.
-- Unblended, the tiny like-minded list scores 100% and beats the big one by a
-- mile; blended, the gap mostly closes, and the newbie gets a number too.
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0013-' || lpad(to_hex(g), 12, '0'))::uuid, format('{"name":"bl_%s#0"}', g)::jsonb
from generate_series(1, 20) g;
-- 1 viewer, 2 small, 3 large, 4 newbie, 5..7 small's friends, 8..19 large's friends.
update public.profiles set ign = 'bl_ign' || lpad((('x' || right(id::text, 2))::bit(8)::int)::text, 2, '0'), friend_code = '1313' || lpad((('x' || right(id::text, 8))::bit(32)::int)::text, 8, '0')
where id::text like '00000000-0000-0000-0013-%';

insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0013-000000000001'::uuid, 'bl' || l, 'want'::public.choice from unnest(array['a', 'b', 'c', 'd', 'e', 'f']) l;
-- small's friends
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0013-' || lpad(to_hex(g), 12, '0'))::uuid, 'bl' || l, 'want'::public.choice
from generate_series(5, 7) g, unnest(array['a', 'b', 'c']) l;
insert into public.friends (user_id, friend_id)
select '00000000-0000-0000-0013-000000000002'::uuid, ('00000000-0000-0000-0013-' || lpad(to_hex(g), 12, '0'))::uuid
from generate_series(5, 7) g;
-- large's friends (k = 0..11)
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0013-' || lpad(to_hex(8 + k), 12, '0'))::uuid, 'bl' || l, 'want'::public.choice
from generate_series(0, 11) k
cross join lateral (
  select unnest(array['a', 'b'])
  union all select unnest(array['c', 'd', 'z1', 'z2', 'z3']) where k % 2 = 0
  union all select unnest(array['e', 'f']) where k % 4 = 0
) x(l);
insert into public.friends (user_id, friend_id)
select '00000000-0000-0000-0013-000000000003'::uuid, ('00000000-0000-0000-0013-' || lpad(to_hex(8 + k), 12, '0'))::uuid
from generate_series(0, 11) k;

create temp table bl_unblended (who text, pct int);
grant all on bl_unblended to authenticated;

-- Unblended: no community rates.
delete from public.community_rates;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0013-000000000001', false);
insert into bl_unblended
select 'small', you_fit_pct from public.lookup_players('bl_ign02')
union all select 'large', you_fit_pct from public.lookup_players('bl_ign03');
do $$
declare s int := (select pct from bl_unblended where who = 'small'); l int := (select pct from bl_unblended where who = 'large');
begin
  assert s = 100, format('unblended small %s', s);
  assert l < 80, format('unblended large %s', l);
  assert (select you_fit_pct from public.lookup_players('bl_ign04')) is null, 'unblended: no list for the newbie';
end $$;
reset role;

-- The community: a..f and z1..z6 each wanted by 30% of players.
insert into public.community_rates (line_id, rate)
select 'bl' || l, 0.3 from unnest(array['a', 'b', 'c', 'd', 'e', 'f', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6']) l;
set role authenticated;
do $$
declare
  s0 int := (select pct from bl_unblended where who = 'small');
  l0 int := (select pct from bl_unblended where who = 'large');
  s int := (select you_fit_pct from public.lookup_players('bl_ign02'));
  l int := (select you_fit_pct from public.lookup_players('bl_ign03'));
begin
  assert s < 100, format('blended small %s', s);
  assert abs(s - l) < (s0 - l0) / 4, format('gap should mostly close: unblended %s vs %s, blended %s vs %s', s0, l0, s, l);
  -- 12 friends barely move; 3 move a lot.
  assert abs(l - l0) < abs(s - s0), format('large moved %s, small %s', l - l0, s - s0);
  -- The newbie is scored on the community, so they show up with a number.
  assert (select you_fit_pct from public.lookup_players('bl_ign04')) is not null, 'newbie has a fit';
  assert exists (
    select 1 from public.browse_players('fit', true, 50, 0)
    where user_id = '00000000-0000-0000-0013-000000000004' and you_fit_pct is not null and list_voters = 0
  ), 'newbie listed on Find New';
end $$;
reset role;

-- The refresh: at most hourly for players, recomputed from active players' wants.
do $$ begin
  perform public.refresh_community_rates_now();
  assert (select rate from public.community_rates where line_id = 'bla') > 0, 'refreshed from votes';
  assert not public.refresh_community_rates(), 'throttled within the hour';
end $$;
set role authenticated;
do $$ begin
  begin
    perform public.refresh_community_rates_now();
    assert false, 'players can''t force a refresh';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.community_rates;
    assert (select count(*) from public.community_rates) = 0, 'cache not readable directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.community_rates;

\echo 'ALL BLEND TESTS PASSED'
