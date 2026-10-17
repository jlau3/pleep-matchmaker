-- Coarse filter flags only, restricted to the caller's eligible suggestions.
-- No account creation timestamp, private votes or third-party relationships.
-- Declines are current retained requests, in either direction; cleared/resubmitted
-- request history is unavailable and must not be described as an eternal hide.
create or replace function public.get_suggestion_filter_flags(ids uuid[])
returns table(user_id uuid, is_new boolean, has_declined boolean)
language sql stable security definer set search_path = '' as $$
 select p.id, p.created_at >= now() - interval '14 days', exists(
  select 1 from public.friend_requests r where r.status='declined'
   and ((r.from_id=auth.uid() and r.to_id=p.id) or (r.to_id=auth.uid() and r.from_id=p.id)))
 from public.trial_candidates(auth.uid()) p
 where p.id=any(ids)
$$;
revoke all on function public.get_suggestion_filter_flags(uuid[]) from public,anon;
grant execute on function public.get_suggestion_filter_flags(uuid[]) to authenticated;
notify pgrst, 'reload schema';
