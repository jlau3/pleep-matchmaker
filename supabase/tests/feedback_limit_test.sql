\set ON_ERROR_STOP on

-- claim_feedback_slot: one per minute, 10 per day, per player; signed-out never.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-000f-000000000001', '{"name":"fb_sender#0"}'),
  ('00000000-0000-0000-000f-000000000002', '{"name":"fb_other#0"}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000f-000000000001', false);
do $$ begin
  assert public.claim_feedback_slot(), 'first send allowed';
  assert not public.claim_feedback_slot(), 'second within a minute blocked';
end $$;
-- Players can't read or clear the log themselves.
do $$ begin
  begin
    delete from public.feedback_sends;
    assert false, 'log should not be writable';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-000f-000000000002', false);
do $$ begin
  assert public.claim_feedback_slot(), 'another player is not affected';
end $$;

select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert not public.claim_feedback_slot(), 'signed out never';
end $$;
reset role;

-- Daily cap: 10 sends spread over the last day block the 11th.
delete from public.feedback_sends where user_id = '00000000-0000-0000-000f-000000000001';
insert into public.feedback_sends (user_id, sent_at)
select '00000000-0000-0000-000f-000000000001', now() - make_interval(mins => 5 + g * 30) from generate_series(1, 10) g;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-000f-000000000001', false);
do $$ begin
  assert not public.claim_feedback_slot(), 'daily cap blocks the 11th';
end $$;
reset role;

\echo 'ALL FEEDBACK LIMIT TESTS PASSED'
