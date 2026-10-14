\set ON_ERROR_STOP on

-- viewer wants a,b,c. Fit = how much of the viewer's wants each candidate's
-- Tier List wants (their own wants stand in while they have under 3 friends
-- with votes). Candidates:
--   good: wants a,b,c          -> 100% fit, a good fit
--   low:  wants a + 9 others   -> 33% fit (only a of a,b,c), only under "everyone"
--   fresh: no votes yet        -> no fit, only under "everyone", listed last
--   stale / closed / blocked   -> never listed
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-000d-000000000001', '{"name":"br_viewer#0"}'),
  ('00000000-0000-0000-000d-000000000002', '{"name":"br_good#0"}'),
  ('00000000-0000-0000-000d-000000000003', '{"name":"br_low#0"}'),
  ('00000000-0000-0000-000d-000000000004', '{"name":"br_fresh#0"}'),
  ('00000000-0000-0000-000d-000000000005', '{"name":"br_stale#0"}'),
  ('00000000-0000-0000-000d-000000000006', '{"name":"br_closed#0"}'),
  ('00000000-0000-0000-000d-000000000007', '{"name":"br_blocked#0"}');
update public.profiles set friend_code = '7777' || right(id::text, 8) where id::text like '00000000-0000-0000-000d-%';
update public.profiles set last_seen_at = now() - interval '5 months' where discord_username = 'br_stale';
update public.profiles set open_to_friends = false where discord_username = 'br_closed';
-- Recency for the 'active' sort: fresh most recent, then low, then good.
update public.profiles set last_seen_at = now() - interval '3 days' where discord_username = 'br_good';
update public.profiles set last_seen_at = now() - interval '2 days' where discord_username = 'br_low';
update public.profiles set last_seen_at = now() - interval '1 day' where discord_username = 'br_fresh';

insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-000d-000000000001', '00000000-0000-0000-000d-000000000002',
                  '00000000-0000-0000-000d-000000000005', '00000000-0000-0000-000d-000000000006',
                  '00000000-0000-0000-000d-000000000007']) u,
     unnest(array['bra', 'brb', 'brc']) l;
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-000d-000000000003'::uuid, l, 'want'::public.choice
from unnest(array['bra', 'bx1', 'bx2', 'bx3', 'bx4', 'bx5', 'bx6', 'bx7', 'bx8', 'bx9']) l;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-000d-000000000001', '00000000-0000-0000-000d-000000000007');
update public.preferences set top = true where user_id = '00000000-0000-0000-000d-000000000002' and line_id = 'bra';

-- The community (normally the cached share of active players wanting each line):
-- a, b, c popular, the nine others less so. Under 3 voting friends a player's
-- list is the community alone, whatever they want themselves.
delete from public.community_rates;
-- Every player now gets a community-based fit, so hide the other test files'
-- players from Find New while this file runs (restored at the end).
create temp table br_hidden as
select id from public.profiles where open_to_friends and discord_username not like 'br\_%';
update public.profiles set open_to_friends = false where id in (select id from br_hidden);
insert into public.community_rates (line_id, rate)
select l, 0.6 from unnest(array['bra', 'brb', 'brc']) l
union all
select 'bx' || g, 0.2 from generate_series(1, 9) g;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);

do $$
declare names text[]; n bigint;
begin
  -- Other test files leave players around; look only at this file's.
  select array_agg(discord_username order by ord), max(total_count) into names, n
  from (select *, row_number() over () as ord from public.browse_players()) t where discord_username like 'br_%';
  -- good, low and fresh have no voting friends, so all three are scored on the
  -- community (which wants the viewer's a, b, c): equal fits, newest first.
  assert names = '{br_fresh,br_low,br_good}', format('good fits: %s', names);

  select array_agg(discord_username order by ord) into names
  from (select *, row_number() over () as ord from public.browse_players('fit', true, 50, 0)) t where discord_username like 'br_%';
  assert names = '{br_fresh,br_low,br_good}', format('everyone by fit: %s', names);

  select array_agg(discord_username order by ord) into names
  from (select *, row_number() over () as ord from public.browse_players('active', true, 50, 0)) t where discord_username like 'br_%';
  assert names = '{br_fresh,br_low,br_good}', format('everyone by activity: %s', names);

  -- A brand-new player isn't hidden: their list is the community's.
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_fresh') = 100, 'new player: community list';
  assert (select list_voters from public.browse_players('fit', true, 50, 0) where discord_username = 'br_fresh') = 0, 'no voting friends';
  -- Their own wants (a + 9 others) don't change "for you" any more.
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_low') = 100, 'own wants ignored';
  -- "For them" needs your friends' votes: the viewer has none yet, so it's unknown,
  -- and good fits go by "for you" alone (br_good is still listed above).
  assert (select match_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_low') is null, 'no friends, no "for them"';
  assert not public.my_friends_voted(), 'no friends voted';
  assert not exists (
    select 1 from public.browse_players('fit', true, 50, 0)
    where discord_username in ('br_stale', 'br_closed', 'br_blocked', 'br_viewer')
  ), 'never listed';
  assert (select top_wants from public.browse_players('fit', true, 50, 0) where discord_username = 'br_good') = '{bra}',
    'top 3 returned';
end $$;

-- Paging: pages don't overlap and total_count covers everything.
do $$
declare first_page uuid[]; second_page uuid[]; total bigint;
begin
  select array_agg(user_id), max(total_count) into first_page, total from public.browse_players('fit', true, 2, 0);
  select array_agg(user_id) into second_page from public.browse_players('fit', true, 2, 2);
  assert cardinality(first_page) = 2, 'page size';
  assert not (first_page && second_page), 'pages overlap';
  assert total >= 3, 'total count';
  assert (select count(*) from public.browse_players('fit', true, 500, 0)) <= 50, 'page size capped at 50';
end $$;
reset role;

-- Their Tier List, not their own wants, once 3+ friends have voted.
--   hub: wants only x1, but three friends (f1..f3) all want a,b,c and also
--        listed the viewer as a friend. Fit 100%: their list wants what the
--        viewer wants, and the viewer's own votes are left out of it.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0010-000000000001', '{"name":"br_hub#0"}'),
  ('00000000-0000-0000-0010-000000000002', '{"name":"br_f1#0"}'),
  ('00000000-0000-0000-0010-000000000003', '{"name":"br_f2#0"}'),
  ('00000000-0000-0000-0010-000000000004', '{"name":"br_f3#0"}');
update public.profiles set friend_code = '6666' || right(id::text, 8), open_to_friends = false
where id::text like '00000000-0000-0000-0010-%';
update public.profiles set open_to_friends = true where discord_username = 'br_hub';
insert into public.preferences (user_id, line_id, choice) values ('00000000-0000-0000-0010-000000000001', 'bx1', 'want');
insert into public.preferences (user_id, line_id, choice)
select u::uuid, l, 'want'::public.choice
from unnest(array['00000000-0000-0000-0010-000000000002', '00000000-0000-0000-0010-000000000003',
                  '00000000-0000-0000-0010-000000000004']) u,
     unnest(array['bra', 'brb', 'brc']) l;
insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0010-000000000001', '00000000-0000-0000-0010-000000000002'),
  ('00000000-0000-0000-0010-000000000001', '00000000-0000-0000-0010-000000000003'),
  ('00000000-0000-0000-0010-000000000001', '00000000-0000-0000-0010-000000000004'),
  ('00000000-0000-0000-0010-000000000001', '00000000-0000-0000-000d-000000000001');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);
do $$ begin
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_hub') = 100,
    'scored on their friends'' wants, not their own';
  assert (select you_fit_wants from public.browse_players('fit', true, 50, 0) where discord_username = 'br_hub') = '{bra,brb,brc}',
    'your wants their list covers';
  assert (select match_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_hub') is null,
    'no friends of yours voted, so no "for them"';
  -- Search shows the same two numbers.
  assert (select you_fit_pct from public.lookup_players('br_hub')) = 100, 'search: you fit theirs';
  assert (select match_pct from public.lookup_players('br_hub')) is null, 'search: no "for them" without friends';
  -- (The they_fit sort can't be told apart here: with no friends' votes, "for them" is null for everyone.)
end $$;
reset role;

-- My Friends shows both numbers once you add them.
insert into public.friends (user_id, friend_id) values ('00000000-0000-0000-000d-000000000001', '00000000-0000-0000-0010-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);
do $$ begin
  assert (select you_fit_pct from public.get_friends() where discord_username = 'br_hub') = 100, 'my friends: you fit theirs';
  assert (select you_fit_pct from public.get_friends(false) where discord_username = 'br_hub') is null, 'skipped without with_match';
end $$;
reset role;
delete from public.friends where user_id = '00000000-0000-0000-000d-000000000001' and friend_id = '00000000-0000-0000-0010-000000000001';

-- With one of the three friends gone, under 3 voters: the community alone (their own x1 doesn't count).
delete from public.friends where user_id = '00000000-0000-0000-0010-000000000001' and friend_id = '00000000-0000-0000-0010-000000000004';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);
do $$ begin
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where discord_username = 'br_hub') = 100,
    'under 3 friends with votes: the community';
  assert (select you_fit_pct from public.lookup_players('br_hub')) = 100, 'search agrees';
end $$;
reset role;
delete from public.community_rates;
update public.profiles set open_to_friends = true where id in (select id from br_hidden);

\echo 'ALL BROWSE TESTS PASSED'
