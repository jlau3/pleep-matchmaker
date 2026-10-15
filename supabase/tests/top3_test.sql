\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0003-000000000001', '{"name":"tara#0"}'),
  ('00000000-0000-0000-0003-000000000002', '{"name":"tom#0"}');
update public.profiles set friend_code = '333300000001' where discord_username = 'tara';
update public.profiles set friend_code = '333300000002' where discord_username = 'tom';

-- tara wants ta..te; tom wants ta..tc and doesn't want td.
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0003-000000000001'::uuid, l, 'want'::public.choice from unnest(array['ta', 'tb', 'tc', 'td', 'te']) l
union all
select '00000000-0000-0000-0003-000000000002'::uuid, l, 'want'::public.choice from unnest(array['ta', 'tb', 'tc']) l
union all
select '00000000-0000-0000-0003-000000000002'::uuid, 'td', 'dont_want'::public.choice;

-- tara's one friend tia wants the same five lines, so they're tara's group.
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0003-000000000003', '{"name":"tia#0"}');
insert into public.preferences (user_id, line_id, choice)
select '00000000-0000-0000-0003-000000000003'::uuid, l, 'want'::public.choice from unnest(array['ta', 'tb', 'tc', 'td', 'te']) l;
insert into public.friends (user_id, friend_id) values
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0003-000000000003');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0003-000000000001', false);

-- Before any stars all shares are 1. tom's three wants are all in it, but he doesn't want td, which
-- tara wants: 3 / (3 + 1) = 75%.
do $$ begin
  assert (select match_pct from public.get_matches() where discord_username = 'tom') = 75, 'pct without stars';
end $$;

-- Star ta: stars don't count in fit, so tom stays at 75%.
update public.preferences set top = true where user_id = auth.uid() and line_id = 'ta';
do $$ begin
  assert (select match_pct from public.get_matches() where discord_username = 'tom') = 75,
    format('pct with star %s', (select match_pct from public.get_matches() where discord_username = 'tom'));
end $$;

-- Cap at three.
update public.preferences set top = true where user_id = auth.uid() and line_id in ('tb', 'tc');
do $$ begin
  begin
    update public.preferences set top = true where user_id = auth.uid() and line_id = 'td';
    assert false, 'should reject a 4th star';
  exception when raise_exception then
    assert sqlerrm = 'top_limit', sqlerrm;
  end;
  assert (select count(*) from public.preferences where user_id = auth.uid() and top) = 3, 'three stars';
end $$;

-- Re-saving an already starred line is not a new star.
update public.preferences set top = true where user_id = auth.uid() and line_id = 'ta';

-- Moving a starred line off want unstars it, which frees a slot.
update public.preferences set choice = 'dont_want' where user_id = auth.uid() and line_id = 'tc';
do $$ begin
  assert not (select top from public.preferences where user_id = auth.uid() and line_id = 'tc'), 'unstarred';
end $$;
insert into public.preferences (user_id, line_id, choice, top) values (auth.uid(), 'te', 'want', true)
  on conflict (user_id, line_id) do update set choice = excluded.choice, top = excluded.top;
do $$ begin
  assert (select array_agg(line_id order by line_id) from public.preferences where user_id = auth.uid() and top) = '{ta,tb,te}', 'stars';
end $$;

-- A star on a non-want is dropped, never stored.
insert into public.preferences (user_id, line_id, choice, top) values (auth.uid(), 'tz', 'undecided', true);
do $$ begin
  assert not (select top from public.preferences where user_id = auth.uid() and line_id = 'tz'), 'non-want star dropped';
end $$;

-- Find New leaves out people you already added.
reset role;
insert into public.friends (user_id, friend_id) values ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0003-000000000002');
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.get_matches() where discord_username = 'tom'), 'friend not in Find New';
end $$;
reset role;
delete from public.friends where user_id = '00000000-0000-0000-0003-000000000001';
set role authenticated;

-- Friends, lookup and community stats expose the stars.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0003-000000000002', false);
-- Friends both ways: votes are friends-only (20261020000800_private_votes.sql).
select public.test_befriend('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0003-000000000001');
set role authenticated;
do $$ begin
  assert (select top_wants from public.get_friends() where discord_username = 'tara') = '{ta,tb,te}', 'get_friends top_wants';
  assert (select top_wants from public.lookup_players('tara')) = '{ta,tb,te}', 'lookup top_wants';
  assert (select tops from public.get_line_stats() where line_id = 'ta') = 1, 'line stats tops';
end $$;

-- tara is tom's only friend, and her "for them" is scored against tom's OTHER
-- friends' votes. There are none, so there's no number (tom's own wants don't stand in).
do $$ begin
  assert (select match_pct from public.get_friends() where discord_username = 'tara') is null,
    format('friend pct %s', (select match_pct from public.get_friends() where discord_username = 'tara'));
end $$;

-- Player search agrees (tom looking up tara), and none for yourself.
do $$ begin
  assert (select match_pct from public.lookup_players('tara')) is null, 'lookup pct';
  assert (select match_pct from public.lookup_players('tom')) is null, 'no pct for yourself';
end $$;

-- No friends' votes and no votes of your own: nothing to compare, no %.
reset role;
insert into auth.users (id, raw_user_meta_data) values ('00000000-0000-0000-0003-000000000009', '{"name":"newbie#0"}');
do $$ begin
  assert public.fit_pct('00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0003-000000000001') is null, 'no group, no pct';
end $$;
set role authenticated;

-- The Tier List asks without match %.
do $$ begin
  assert (select match_pct from public.get_friends(false) where discord_username = 'tara') is null, 'no pct when with_match is false';
  assert (select top_wants from public.get_friends(false) where discord_username = 'tara') = '{ta,tb,te}', 'votes still returned';
end $$;

-- A friend who hides their list shows no %.
reset role;
update public.profiles set allow_lookup = false where discord_username = 'tara';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0003-000000000002', false);
set role authenticated;
do $$ begin
  assert (select match_pct from public.get_friends() where discord_username = 'tara') is null, 'hidden friend has no pct';
end $$;

-- Not callable directly.
do $$ begin
  begin
    perform public.fit_pct(auth.uid(), auth.uid());
    assert false, 'fit_pct should not be callable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.group_demand(auth.uid());
    assert false, 'group_demand should not be callable';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'ALL TOP 3 TESTS PASSED'
