create table if not exists public.api_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  subject text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists api_rate_limit_events_action_subject_created_idx
  on public.api_rate_limit_events (action, subject, created_at desc);
