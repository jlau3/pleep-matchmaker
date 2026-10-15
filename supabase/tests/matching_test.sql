-- Run with scripts/test-db.sh. Raises an exception on the first failed check.
\set ON_ERROR_STOP on


-- Users: a (caller), b, c, d, e
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"provider_id":"1","name":"alice#0","custom_claims":{"global_name":"Alice"}}'),
  ('00000000-0000-0000-0000-00000000000b', '{"provider_id":"2","name":"bob#0"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"provider_id":"3","name":"cara#0"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"provider_id":"4","name":"dan#0"}'),
  ('00000000-0000-0000-0000-00000000000e', '{"provider_id":"5","name":"eve#0"}');

update public.profiles set friend_code = '10000000000' || (ascii(right(id::text, 1)) % 10), ign = 'ign_' || discord_username;

do $$ begin
  assert (select discord_username from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'alice', 'username sync';
  assert (select discord_display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'display name sync';
end $$;

-- a's one friend f wants w1..w10, so that's the group ("for them" needs a
-- friend's votes; a's own wants don't stand in).
-- b wants 10 lines, 6 of them the group's: fit 6 / 10 = 60%.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000a'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 10) g
union all
select '00000000-0000-0000-0000-00000000000a'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g
union all
select '00000000-0000-0000-0000-00000000000a'::uuid, 'u1', 'undecided'::public.choice;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000f', '{"provider_id":"6","name":"fay#0"}');
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000f'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 10) g;
insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000f');

insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000b'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 6) g
union all
select '00000000-0000-0000-0000-00000000000b'::uuid, 'x' || g, 'want'::public.choice from generate_series(1, 4) g
union all
select '00000000-0000-0000-0000-00000000000b'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g;

-- c: like b with only 2 extra wants, and dont-wants on a's lines w9, w10,
-- which each cost a full want: 6 / (8 + 2) = 60%.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000c'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 6) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'x' || g, 'want'::public.choice from generate_series(1, 2) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'w' || g, 'dont_want'::public.choice from generate_series(9, 10) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g;

-- d: 100% fit but only 2 wants in the group -> below min_shared_wants, hidden.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000d'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 2) g;

-- e: identical to b but stale -> hidden.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000e'::uuid, line_id, choice
from public.preferences where user_id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set last_seen_at = now() - interval '5 months' where id = '00000000-0000-0000-0000-00000000000e';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select discord_username, match_pct, fit_wants, fit_dont_wants from public.get_matches();

do $$
declare r record;
begin
  select * into r from public.get_matches() where user_id = public.test_uid('bob');
  assert r.match_pct = 60, format('bob pct %s', r.match_pct);
  assert cardinality(r.fit_wants) = 6, 'bob fit wants';
  assert r.friend_code is null, 'no friend code in matches (20261021000900)';

  select * into r from public.get_matches() where user_id = public.test_uid('cara');
  assert r.match_pct = 60, format('cara pct %s', r.match_pct);
  assert r.fit_dont_wants = '{w10,w9}', format('cara dont-wants %s', r.fit_dont_wants);

  assert not exists (select 1 from public.get_matches() where user_id = public.test_uid('dan')), 'dan below min shared wants';
  assert not exists (select 1 from public.get_matches() where user_id = public.test_uid('eve')), 'eve stale';
  assert (select count(*) from public.get_matches()) = 2, 'exactly two matches';
end $$;

-- RLS: a cannot read other profiles or prefs directly.
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'profiles RLS';
  assert (select count(*) from public.preferences where user_id <> auth.uid()) = 0, 'preferences RLS';
end $$;

-- Blocking hides in both directions.
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert not exists (select 1 from public.get_matches() where user_id = public.test_uid('bob')), 'blocked hidden';
  assert not exists (select 1 from public.lookup_players('bob') where user_id = '00000000-0000-0000-0000-00000000000b'), 'blocked hidden from lookup';
  assert (select count(*) from public.get_blocked()) = 1, 'get_blocked';
end $$;
delete from public.blocks where blocker_id = auth.uid();

-- open_to_friends=false hides from matches but not lookup.
reset role;
update public.profiles set open_to_friends = false where discord_username = 'bob';
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.get_matches() where user_id = public.test_uid('bob')), 'closed hidden from matches';
  assert exists (select 1 from public.lookup_players('BOB') where user_id = '00000000-0000-0000-0000-00000000000b'), 'closed still found by lookup';
end $$;

-- Lookup by username/IGN/friend code (close names too, see search_test); allow_lookup=false hides.
do $$
declare r record;
begin
  assert not exists (select 1 from public.lookup_players('bo') where user_id <> auth.uid()), 'two letters: exact only';
  assert exists (select 1 from public.lookup_players('@Bob')), 'leading @ and case ignored';
  assert exists (select 1 from public.lookup_players('ign_cara')), 'by ign';
  assert exists (select 1 from public.lookup_players('IGN_CARA')), 'ign any case';
  assert exists (select 1 from public.lookup_players('  ign_cara  ')), 'surrounding spaces';
  assert exists (select 1 from public.lookup_players('ＩＧＮ＿ＣＡＲＡ')), 'full-width';
  select * into r from public.lookup_players('ign_bob');
  -- Votes are friends-only (20261020000800_private_votes.sql): found by search, but no prefs.
  assert r.user_id is not null and cardinality(r.wants) = 0 and cardinality(r.dont_wants) = 0, 'lookup hides a stranger''s prefs';
end $$;
reset role;
update public.profiles set friend_code = '123412341234' where discord_username = 'dan';
update public.profiles set allow_lookup = false where discord_username = 'cara';
set role authenticated;
do $$ begin
  assert exists (select 1 from public.lookup_players('1234-1234-1234')), 'by friend code with separators';
  assert not exists (select 1 from public.lookup_players('cara') where user_id = '00000000-0000-0000-0000-00000000000c'), 'allow_lookup off';
end $$;

-- Stats: counts active users only (eve is stale).
do $$ begin
  assert (select wants from public.get_line_stats() where line_id = 'w1') = 5, 'w1 wants a,b,c,d,f';
  assert (select dont_wants from public.get_line_stats() where line_id = 'd1') = 3, 'd1 dont a,b,c';
end $$;

-- Voter count: active users with a want/dont vote. Other test files leave
-- voters behind, so check deltas: stale e and undecided-only users don't count.
reset role;
create temp table vc as select public.get_voter_count() as n;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f0', '{"name":"meh#0"}');
insert into public.preferences values ('00000000-0000-0000-0000-0000000000f0', 'w1', 'undecided');
do $$ begin
  assert public.get_voter_count() = (select n from vc), 'undecided-only not counted';
end $$;
update public.profiles set last_seen_at = now() where discord_username = 'eve';
do $$ begin
  assert public.get_voter_count() = (select n from vc) + 1, 'stale user counted once active';
end $$;
update public.profiles set last_seen_at = now() - interval '5 months' where discord_username = 'eve';
set role authenticated;

-- prefs_updated_at only moves on a real change.
reset role;
update public.profiles set prefs_updated_at = '2020-01-01' where discord_username = 'alice';
set role authenticated;
update public.preferences set choice = 'want' where user_id = auth.uid() and line_id = 'w1';
do $$ begin
  assert (select prefs_updated_at from public.profiles where id = auth.uid()) = '2020-01-01', 'no-op write keeps timestamp';
end $$;
update public.preferences set choice = 'dont_want' where user_id = auth.uid() and line_id = 'w1';
do $$ begin
  assert (select prefs_updated_at from public.profiles where id = auth.uid()) > now() - interval '1 minute', 'real change bumps timestamp';
end $$;

-- Clients cannot write trigger-owned columns.
do $$ begin
  begin
    update public.profiles set discord_username = 'hacker' where id = auth.uid();
    assert false, 'discord_username should not be writable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Account deletion cascades.
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from public.profiles where discord_username = 'alice'), 'profile deleted';
  assert not exists (select 1 from public.preferences where user_id = '00000000-0000-0000-0000-00000000000a'), 'prefs deleted';
end $$;

-- Signed-out (anon) callers can't reach any player data.
set role anon;
do $$ begin
  begin
    perform public.get_matches();
    assert false, 'anon get_matches';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lookup_players('bob');
    assert false, 'anon lookup';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.profiles;
    assert false, 'anon profiles';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'ALL DB TESTS PASSED'
