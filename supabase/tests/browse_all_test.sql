\set ON_ERROR_STOP on

-- 20261020000500_browse_all.sql: browse_all lists the same players as
-- browse_players under Everyone, in Best match order, flags exactly the ones
-- Good matches shows, and carries the same numbers.
select setseed(0.27);
insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0027-' || lpad(g::text, 12, '0'))::uuid, jsonb_build_object('name', 'ba' || g || '#0')
from generate_series(1, 40) g;
update public.profiles set friend_code = '2700' || right(replace(id::text, '-', ''), 8) where id::text like '00000000-0000-0000-0027-%';
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0027-' || lpad(g::text, 12, '0'))::uuid, 'ba' || l,
  (array['want', 'want', 'dont_want', 'undecided'])[1 + floor(random() * 4)::int]::public.choice
from generate_series(1, 40) g, generate_series(1, 10) l
where random() < 0.6;
select public.test_befriend(('00000000-0000-0000-0027-' || lpad(a::text, 12, '0'))::uuid, ('00000000-0000-0000-0027-' || lpad(b::text, 12, '0'))::uuid)
from generate_series(1, 40) a, generate_series(1, 40) b
where a < b and random() < 0.15;
update public.profiles set game_avatar = 'pikachu:happy' where id = '00000000-0000-0000-0027-000000000002';

-- Strangers see IGNs, not Discord names (20261020001100_discord_friends_only.sql): IGN = Discord name here.
update public.profiles set ign = coalesce(ign, discord_username) where id::text like '00000000-0000-0000-0027-%';
-- Existing social fixtures include a chosen icon.
update public.profiles set game_avatar = coalesce(game_avatar, 'pikachu:normal') where id::text like any (array['00000000-0000-0000-0027-%']);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0027-000000000001', false);
do $$
declare
  paged uuid[];
  good_paged uuid[];
  everything uuid[];
  good uuid[];
begin
  select array_agg(b.user_id order by pg.n, b.ord) into paged
  from generate_series(0, 19) pg(n)
  cross join lateral (select x.user_id, row_number() over () as ord from public.browse_players('fit', true, 50, pg.n * 50, 10) x) b;
  select array_agg(b.user_id order by pg.n, b.ord) into good_paged
  from generate_series(0, 19) pg(n)
  cross join lateral (select x.user_id, row_number() over () as ord from public.browse_players('fit', false, 50, pg.n * 50, 10) x) b;
  select array_agg(a.user_id order by a.ord) into everything
  from (select x.user_id, row_number() over () as ord from public.browse_all() x) a;
  select array_agg(a.user_id order by a.ord) filter (where a.good) into good
  from (select x.user_id, x.good, row_number() over () as ord from public.browse_all() x) a;

  assert cardinality(everything) > 20, format('enough players: %s', cardinality(everything));
  assert everything = paged, 'same players, same Best match order as browse_players';
  assert coalesce(good, '{}') = coalesce(good_paged, '{}'), format('good flags match Good matches: %s vs %s', good, good_paged);
  assert not exists (
    select 1 from public.browse_all() a
    join public.browse_players('fit', true, 50, 0, 10) b using (user_id)
    where a.match_pct is distinct from b.match_pct or a.you_fit_pct is distinct from b.you_fit_pct
       or a.you_fit_wants is distinct from b.you_fit_wants or a.list_voters is distinct from b.list_voters
  ), 'same numbers';
  assert (select game_avatar from public.browse_all() where user_id = '00000000-0000-0000-0027-000000000002') = 'pikachu:happy', 'icon carried';
end $$;
reset role;

\echo 'ALL BROWSE ALL TESTS PASSED'
