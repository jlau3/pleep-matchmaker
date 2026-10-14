\set ON_ERROR_STOP on

-- me; ann and bob added me; cal added me but has lookup off; dee added me and I blocked her.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-000c-000000000001', '{"name":"ay_me#0"}'),
  ('00000000-0000-0000-000c-000000000002', '{"name":"ay_ann#0"}'),
  ('00000000-0000-0000-000c-000000000003', '{"name":"ay_bob#0"}'),
  ('00000000-0000-0000-000c-000000000004', '{"name":"ay_cal#0"}'),
  ('00000000-0000-0000-000c-000000000005', '{"name":"ay_dee#0"}');
insert into public.friends (user_id, friend_id)
select ('00000000-0000-0000-000c-00000000000' || n)::uuid, '00000000-0000-0000-000c-000000000001'::uuid
from generate_series(2, 5) n;
update public.profiles set allow_lookup = false where discord_username = 'ay_cal';
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-000c-000000000001', '00000000-0000-0000-000c-000000000005');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000c-000000000001', false);
do $$ begin
  assert (select array_agg(discord_username order by discord_username) from public.get_added_me()) = '{ay_ann,ay_bob}',
    format('added me: %s', (select array_agg(discord_username) from public.get_added_me()));
end $$;

-- Adding back clears the prompt and shows "added you too" on My Friends.
insert into public.friends (user_id, friend_id) values (auth.uid(), '00000000-0000-0000-000c-000000000002');
do $$ begin
  assert not exists (select 1 from public.get_added_me() where discord_username = 'ay_ann'), 'added back';
  assert (select added_me from public.get_friends() where discord_username = 'ay_ann'), 'mutual flag';
end $$;

-- Dismissing clears it too; undoing the dismissal brings it back.
insert into public.friend_prompt_dismissals (user_id, adder_id) values (auth.uid(), '00000000-0000-0000-000c-000000000003');
do $$ begin
  assert not exists (select 1 from public.get_added_me()), 'dismissed';
end $$;
delete from public.friend_prompt_dismissals where user_id = auth.uid();
do $$ begin
  assert exists (select 1 from public.get_added_me() where discord_username = 'ay_bob'), 'undismissed';
end $$;

-- Ann removing me takes her off my list too (friends_upkeep: unfriending is two-sided).
reset role;
delete from public.friends where user_id = '00000000-0000-0000-000c-000000000002';
set role authenticated;
do $$ begin
  assert not exists (select 1 from public.get_friends() where discord_username = 'ay_ann'), 'removed both ways';
end $$;

-- Can't write someone else's dismissals.
do $$ begin
  begin
    insert into public.friend_prompt_dismissals (user_id, adder_id) values ('00000000-0000-0000-000c-000000000002', auth.uid());
    assert false, 'foreign dismissal should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'ALL ADDED-YOU TESTS PASSED'
