create table if not exists public.learning_study_set_reports (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null default 'content_issue'
    check (reason in ('content_issue', 'wrong_answers', 'inappropriate', 'duplicate', 'other')),
  detail text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_set_id, reporter_user_id)
);

drop trigger if exists learning_study_set_reports_set_updated_at on public.learning_study_set_reports;
create trigger learning_study_set_reports_set_updated_at
  before update on public.learning_study_set_reports
  for each row
  execute procedure public.set_current_timestamp_updated_at();

alter table public.learning_study_set_reports enable row level security;

revoke all on table public.learning_study_set_reports from anon;
revoke all on table public.learning_study_set_reports from authenticated;

create index if not exists learning_study_set_reports_study_set_status_idx
  on public.learning_study_set_reports (study_set_id, status, created_at desc);

create index if not exists learning_study_set_reports_reporter_idx
  on public.learning_study_set_reports (reporter_user_id, created_at desc);
