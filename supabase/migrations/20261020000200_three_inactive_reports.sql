-- Hide a player from everyone's Find New after 3 "stopped playing" reports
-- (was 2): two could be a coincidence. Your own report still hides them from
-- you right away, and any report is void once they're back. Safe to re-run.
create or replace function public.inactive_reports_to_hide()
returns int
language sql
immutable
as $$ select 3 $$;
