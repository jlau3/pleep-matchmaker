-- Restore-list identity must not depend on current matchmaking eligibility.
-- A full/inactive/closed player is still identifiable if lookup is allowed.
-- Never return private contact details, votes, fit or another viewer's hides.
create or replace function public.get_hidden_suggestions()
returns table(user_id uuid, ign text)
language sql stable security definer set search_path = '' as $$
 select h.hidden_user_id,
 case when (p.allow_lookup or exists(select 1 from public.friends f
   where f.user_id=auth.uid() and f.friend_id=p.id))
  and not exists(select 1 from public.blocks b
   where (b.blocker_id=auth.uid() and b.blocked_id=p.id)
      or (b.blocker_id=p.id and b.blocked_id=auth.uid()))
 then p.ign end
 from public.hidden_suggestions h join public.profiles p on p.id=h.hidden_user_id
 where h.user_id=auth.uid()
 order by h.created_at desc,h.hidden_user_id
$$;
revoke all on function public.get_hidden_suggestions() from public,anon;
grant execute on function public.get_hidden_suggestions() to authenticated;
