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
-- Stale means unseen for 2 months (match_config): 10 weeks is out.
update public.profiles set last_seen_at = now() - interval '10 weeks' where discord_username = 'br_stale';
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

-- Strangers see IGNs, not Discord names (20261020001100_discord_friends_only.sql): IGN = Discord name here.
update public.profiles set ign = coalesce(ign, discord_username) where id::text like '00000000-0000-0000-000d-%';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);

do $$
declare names text[]; n bigint;
begin
  -- Other test files leave players around; look only at this file's.
  select array_agg(public.test_name(user_id) order by ord), max(total_count) into names, n
  from (select *, row_number() over () as ord from public.browse_players()) t where public.test_name(user_id) like 'br_%';
  -- Nobody here has 3 friends voting and the viewer has no friends yet, so
  -- every number is a dash and no one is a good fit (yet).
  assert names is null, format('good fits: %s', names);

  select array_agg(public.test_name(user_id) order by ord) into names
  from (select *, row_number() over () as ord from public.browse_players('fit', true, 50, 0)) t where public.test_name(user_id) like 'br_%';
  -- Everyone still lists them, newest first while there's no fit to sort by.
  assert names = '{br_fresh,br_low,br_good}', format('everyone by fit: %s', names);

  select array_agg(public.test_name(user_id) order by ord) into names
  from (select *, row_number() over () as ord from public.browse_players('active', true, 50, 0)) t where public.test_name(user_id) like 'br_%';
  assert names = '{br_fresh,br_low,br_good}', format('everyone by activity: %s', names);

  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_fresh')) is null, 'no votes, no fit';
  -- Their own wants don't stand in for a friends list.
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_low')) is null, 'no friends voting, no "for you"';
  assert (select not voted from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_fresh')), 'fresh hasn''t voted';
  assert (select voted and list_voters = 0 from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_low')), 'low voted, no list';
  -- "For them" needs your friends' votes: the viewer has none yet, so it's unknown,
  -- and good fits go by "for you" alone (br_good is still listed above).
  assert (select match_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_low')) is null, 'no friends, no "for them"';
  assert not public.my_friends_voted(), 'no friends voted';
  assert not exists (
    select 1 from public.browse_players('fit', true, 50, 0)
    where public.test_name(user_id) in ('br_stale', 'br_closed', 'br_blocked', 'br_viewer')
  ), 'never listed';
  -- Votes are friends-only (20261020000800_private_votes.sql): a stranger's Top 3 stays hidden.
  assert (select top_wants from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_good')) = '{}',
    'stranger top 3 hidden';
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
update public.profiles set ign = discord_username where id::text like '00000000-0000-0000-0010-%';
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
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_hub')) = 100,
    'scored on their friends'' wants, not their own';
  assert (select you_fit_wants from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_hub')) = '{bra,brb,brc}',
    'your wants their list covers';
  assert (select match_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_hub')) is null,
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

-- With one of the three friends gone, under 3 voters: no "for you" (their own x1 doesn't stand in).
delete from public.friends where user_id = '00000000-0000-0000-0010-000000000001' and friend_id = '00000000-0000-0000-0010-000000000004';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000d-000000000001', false);
do $$ begin
  assert (select you_fit_pct from public.browse_players('fit', true, 50, 0) where user_id = public.test_uid('br_hub')) is null,
    'under 3 friends with votes: a dash';
  assert (select you_fit_pct from public.lookup_players('br_hub')) is null, 'search agrees';
end $$;
reset role;

\echo 'ALL BROWSE TESTS PASSED'
