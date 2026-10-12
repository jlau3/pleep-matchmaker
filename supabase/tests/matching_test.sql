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

-- Worked example from the design discussion.
-- a and b each want 10 lines, share 6; the other 4 are unpicked on the other side.
-- Both dont-want 3 lines. Expected 21 / 45 = 47%.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000a'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 10) g
union all
select '00000000-0000-0000-0000-00000000000a'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g
union all
select '00000000-0000-0000-0000-00000000000a'::uuid, 'u1', 'undecided'::public.choice;

insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000b'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 6) g
union all
select '00000000-0000-0000-0000-00000000000b'::uuid, 'x' || g, 'want'::public.choice from generate_series(1, 4) g
union all
select '00000000-0000-0000-0000-00000000000b'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g;

-- c: same as b but 2 of b's extra wants become dont-wants on a's lines w9, w10.
-- Score 6*3 + 3*1 - 2*3 = 15; best = (10 a-wants + 2 c-wants) * 3 + 3 = 39 -> 38%.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000c'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 6) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'x' || g, 'want'::public.choice from generate_series(1, 2) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'w' || g, 'dont_want'::public.choice from generate_series(9, 10) g
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, 'd' || g, 'dont_want'::public.choice from generate_series(1, 3) g;

-- d: only 2 shared wants, high % otherwise -> below min_shared_wants, hidden.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000d'::uuid, 'w' || g, 'want'::public.choice from generate_series(1, 2) g;

-- e: identical to b but stale -> hidden.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0000-00000000000e'::uuid, line_id, choice
from public.preferences where user_id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set last_seen_at = now() - interval '5 months' where id = '00000000-0000-0000-0000-00000000000e';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select discord_username, match_pct, cardinality(shared_wants) as shared, shared_dont_wants from public.get_matches();

do $$
declare r record;
begin
  select * into r from public.get_matches() where discord_username = 'bob';
  assert r.match_pct = 47, format('bob pct %s', r.match_pct);
  assert cardinality(r.shared_wants) = 6, 'bob shared wants';
  assert r.friend_code is not null, 'contact info returned for match';

  select * into r from public.get_matches() where discord_username = 'cara';
  assert r.match_pct = 38, format('cara pct %s', r.match_pct);

  assert not exists (select 1 from public.get_matches() where discord_username = 'dan'), 'dan below min shared wants';
  assert not exists (select 1 from public.get_matches() where discord_username = 'eve'), 'eve stale';
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
  assert not exists (select 1 from public.get_matches() where discord_username = 'bob'), 'blocked hidden';
  assert not exists (select 1 from public.lookup_players('bob')), 'blocked hidden from lookup';
  assert (select count(*) from public.get_blocked()) = 1, 'get_blocked';
end $$;
delete from public.blocks where blocker_id = auth.uid();

-- open_to_friends=false hides from matches but not lookup.
reset role;
update public.profiles set open_to_friends = false where discord_username = 'bob';
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.get_matches() where discord_username = 'bob'), 'closed hidden from matches';
  assert exists (select 1 from public.lookup_players('BOB')), 'closed still found by lookup';
end $$;

-- Lookup: exact only, by username/IGN/friend code; allow_lookup=false hides.
do $$
declare r record;
begin
  assert not exists (select 1 from public.lookup_players('bo')), 'no partial match';
  assert exists (select 1 from public.lookup_players('@Bob')), 'leading @ and case ignored';
  assert exists (select 1 from public.lookup_players('ign_cara')), 'by ign';
  select * into r from public.lookup_players('ign_bob');
  assert cardinality(r.wants) = 10 and cardinality(r.dont_wants) = 3, 'lookup returns prefs';
end $$;
reset role;
update public.profiles set friend_code = '123412341234' where discord_username = 'dan';
update public.profiles set allow_lookup = false where discord_username = 'cara';
set role authenticated;
do $$ begin
  assert exists (select 1 from public.lookup_players('1234-1234-1234')), 'by friend code with separators';
  assert not exists (select 1 from public.lookup_players('cara')), 'allow_lookup off';
end $$;

-- Stats: counts active users only (eve is stale).
do $$ begin
  assert (select wants from public.get_line_stats() where line_id = 'w1') = 4, 'w1 wants a,b,c,d';
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
