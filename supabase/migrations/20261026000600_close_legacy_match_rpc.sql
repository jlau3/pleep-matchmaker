-- get_matches is an unused pre-browse RPC that exposes the other direction.
-- The trial client has no fallback to it. Closing this compatibility endpoint
-- is essential: the accepted Recommended flag must be the only other-side
-- match disclosure in the suggestions API, including direct RPC calls.
revoke all on function public.get_matches() from public, anon, authenticated;
notify pgrst, 'reload schema';
