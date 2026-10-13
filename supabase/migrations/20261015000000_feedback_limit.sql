-- Server-side limit on Send feedback, which posts to the developer's Discord
-- channel. The browser cookie cooldown is easy to skip with a script; this
-- isn't: one message a minute and 10 a day per account. Players can't read or
-- write the log directly; only claim_feedback_slot() touches it. Safe to re-run.

create table if not exists public.feedback_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index if not exists feedback_sends_user_idx on public.feedback_sends (user_id, sent_at);

alter table public.feedback_sends enable row level security;
revoke all on public.feedback_sends from anon, authenticated;

-- True (and records the send) when the caller may send feedback now.
create or replace function public.claim_feedback_slot()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return false;
  end if;
  -- One at a time per player, so two quick clicks can't both pass the checks.
  perform pg_advisory_xact_lock(hashtext('feedback:' || me::text));
  if exists (select 1 from public.feedback_sends where user_id = me and sent_at > now() - interval '1 minute')
     or (select count(*) from public.feedback_sends where user_id = me and sent_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  delete from public.feedback_sends where user_id = me and sent_at < now() - interval '1 day';
  insert into public.feedback_sends (user_id) values (me);
  return true;
end;
$$;

revoke execute on function public.claim_feedback_slot() from public, anon;
grant execute on function public.claim_feedback_slot() to authenticated;
