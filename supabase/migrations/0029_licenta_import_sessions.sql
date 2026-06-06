create table if not exists public.ai_licenta_import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_bank_id uuid references public.ai_question_banks(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'failed')),
  set_count integer not null default 0 check (set_count >= 0),
  completed_set_count integer not null default 0 check (completed_set_count >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  questions_with_answers integer not null default 0 check (questions_with_answers >= 0),
  questions_missing_answers integer not null default 0 check (questions_missing_answers >= 0),
  needs_review_count integer not null default 0 check (needs_review_count >= 0),
  credit_consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

alter table public.ai_import_jobs
  add column if not exists licenta_session_id uuid references public.ai_licenta_import_sessions(id) on delete set null,
  add column if not exists set_index integer check (set_index is null or set_index > 0);

create index if not exists ai_licenta_import_sessions_user_status_idx
  on public.ai_licenta_import_sessions (user_id, status, updated_at desc);

create index if not exists ai_import_jobs_licenta_session_idx
  on public.ai_import_jobs (licenta_session_id, set_index);

create unique index if not exists ai_import_jobs_licenta_session_set_unique_idx
  on public.ai_import_jobs (licenta_session_id, set_index)
  where licenta_session_id is not null and set_index is not null;

create unique index if not exists ai_credit_ledger_licenta_session_consume_unique_idx
  on public.ai_credit_ledger ((metadata->>'licentaSessionId'))
  where source = 'generation'
    and reason = 'generation_consume'
    and delta < 0
    and metadata ? 'licentaSessionId';

drop trigger if exists ai_licenta_import_sessions_set_updated_at on public.ai_licenta_import_sessions;
create trigger ai_licenta_import_sessions_set_updated_at
  before update on public.ai_licenta_import_sessions
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.ai_licenta_import_sessions enable row level security;

create policy "ai_licenta_import_sessions_owner_all"
  on public.ai_licenta_import_sessions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
