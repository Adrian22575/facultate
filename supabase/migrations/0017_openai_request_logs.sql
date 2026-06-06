create table if not exists public.openai_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  job_id uuid references public.ai_generation_jobs(id) on delete set null,
  operation text not null,
  request_scope text not null,
  status text not null check (status in ('succeeded', 'failed')),
  model text,
  reasoning_effort text,
  response_id text,
  openai_file_id text,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  prompt_text text,
  input_preview text,
  output_preview text,
  error_message text,
  usage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists openai_request_logs_created_at_idx
  on public.openai_request_logs (created_at desc);

create index if not exists openai_request_logs_job_id_idx
  on public.openai_request_logs (job_id, created_at desc);

create index if not exists openai_request_logs_scope_status_idx
  on public.openai_request_logs (request_scope, status, created_at desc);

alter table public.openai_request_logs enable row level security;
