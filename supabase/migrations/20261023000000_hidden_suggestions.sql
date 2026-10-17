-- Personal suggestion preferences; hiding does not block or unfriend anyone.
create table public.hidden_suggestions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hidden_user_id),
  check (user_id <> hidden_user_id)
);
alter table public.hidden_suggestions enable row level security;
create policy own_hidden_suggestions on public.hidden_suggestions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.hidden_suggestions from public, anon, authenticated;
grant select, insert, delete on public.hidden_suggestions to authenticated;

alter table public.profiles add column match_guide_seen boolean not null default false;
grant update (match_guide_seen) on public.profiles to authenticated;
