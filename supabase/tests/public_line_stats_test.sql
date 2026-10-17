\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0040-' || lpad(i::text, 12, '0'))::uuid, '{}'::jsonb
from generate_series(1, 11) i;
update public.profiles set last_seen_at = now() where id::text like '00000000-0000-0000-0040-%';
update public.profiles set last_seen_at = now() - interval '3 months'
where id = '00000000-0000-0000-0040-000000000011';
-- Ten active people saw enough, nine saw early. Only one wants anything;
-- the nine all-Neutral accounts must still count toward the threshold.
insert into public.preferences (user_id, line_id, choice, top)
select ('00000000-0000-0000-0040-' || lpad(i::text, 12, '0'))::uuid,
  'public_enough', case when i = 1 then 'want'::public.choice else 'undecided'::public.choice end, i = 1
from generate_series(1, 11) i;
insert into public.preferences (user_id, line_id, choice)
select ('00000000-0000-0000-0040-' || lpad(i::text, 12, '0'))::uuid, 'public_early', 'want'
from generate_series(1, 9) i;
insert into public.preferences (user_id, line_id, choice) values
  ('00000000-0000-0000-0040-000000000011', 'public_stale', 'want');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare row record;
begin
  assert not has_function_privilege('anon', 'public.get_line_stats()', 'EXECUTE'), 'raw totals remain private';
  assert not has_function_privilege('anon', 'public.get_voter_count()', 'EXECUTE'), 'raw voter count remains private';
  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    assert not exists (select 1 from public.profiles), 'no profile access';
  end if;
  if has_table_privilege('anon', 'public.preferences', 'SELECT') then
    assert not exists (select 1 from public.preferences), 'no individual vote access';
  end if;
  select * into row from public.get_public_line_stats() where line_id = 'public_early';
  assert found and row.wants is null and row.dont_wants is null and row.tops is null and row.seen is null and row.voters is null,
    'below ten: every numeric field is masked, even via a direct anonymous RPC';
  select * into row from public.get_public_line_stats() where line_id = 'public_stale';
  assert found and row.wants is null and row.seen is null, 'inactive players do not qualify';
  select * into row from public.get_public_line_stats() where line_id = 'public_enough';
  assert found and row.seen = 10 and row.wants = 1 and row.dont_wants = 0 and row.tops = 1,
    'exactly ten, including Neutral-only players; inactive eleventh is excluded';
end $$;
reset role;
\echo 'ALL PUBLIC LINE STATS TESTS PASSED'
