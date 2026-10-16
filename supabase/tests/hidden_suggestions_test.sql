\set ON_ERROR_STOP on
insert into auth.users (id, raw_user_meta_data) values
 ('00000000-0000-0000-0099-000000000001', '{"name":"hide-one#0"}'),
 ('00000000-0000-0000-0099-000000000002', '{"name":"hide-two#0"}'),
 ('00000000-0000-0000-0099-000000000003', '{"name":"hide-three#0"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0099-000000000001', false);
insert into public.hidden_suggestions (user_id, hidden_user_id) values (auth.uid(), '00000000-0000-0000-0099-000000000002');
update public.profiles set match_guide_seen = true where id = auth.uid();
do $$ begin
 assert (select count(*) from public.hidden_suggestions) = 1, 'owner can read saved preference';
 assert (select match_guide_seen from public.profiles where id = auth.uid()), 'guide seen can be saved';
 assert not exists (select 1 from public.blocks where blocker_id = auth.uid()), 'hiding is not blocking';
 begin
  insert into public.hidden_suggestions values (auth.uid(), auth.uid(), now());
  assert false, 'self hiding must fail';
 exception when check_violation then null; end;
 begin
  insert into public.hidden_suggestions values ('00000000-0000-0000-0099-000000000003', auth.uid(), now());
  assert false, 'cannot create preferences for someone else';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0099-000000000002', false);
do $$ begin
 assert (select count(*) from public.hidden_suggestions) = 0, 'hidden player cannot see who hid them';
end $$;
delete from public.hidden_suggestions;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0099-000000000001', false);
do $$ begin
 assert (select count(*) from public.hidden_suggestions) = 1, 'other account cannot restore my suggestions';
end $$;
delete from public.hidden_suggestions where user_id = auth.uid();
do $$ begin
 assert (select count(*) from public.hidden_suggestions) = 0, 'owner can restore';
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform 1 from public.hidden_suggestions;
  assert false, 'anonymous access must fail';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo 'ALL HIDDEN SUGGESTIONS TESTS PASSED'
