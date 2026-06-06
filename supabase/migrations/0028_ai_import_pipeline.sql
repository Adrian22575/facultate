create table if not exists public.ai_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  result_bank_id uuid references public.ai_question_banks(id) on delete set null,
  mode text not null check (mode in ('auto', 'set')),
  source_type text not null check (source_type in ('pdf', 'docx', 'txt', 'paste')),
  file_name text,
  title text,
  status text not null default 'uploaded'
    check (status in (
      'uploaded',
      'extracting',
      'chunking',
      'processing',
      'matching_answers',
      'ready_for_preview',
      'completed',
      'completed_with_warnings',
      'needs_review',
      'failed'
    )),
  total_chunks integer not null default 0 check (total_chunks >= 0),
  processed_chunks integer not null default 0 check (processed_chunks >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  questions_with_answers integer not null default 0 check (questions_with_answers >= 0),
  questions_missing_answers integer not null default 0 check (questions_missing_answers >= 0),
  needs_review_count integer not null default 0 check (needs_review_count >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.ai_import_question_sets (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  source_label text,
  page_start integer check (page_start is null or page_start >= 1),
  page_end integer check (page_end is null or page_end >= 1),
  chunk_start integer check (chunk_start is null or chunk_start >= 0),
  chunk_end integer check (chunk_end is null or chunk_end >= 0),
  status text not null default 'extracting'
    check (status in ('extracting', 'missing_answers', 'matched', 'needs_review', 'completed', 'failed')),
  question_count integer not null default 0 check (question_count >= 0),
  answer_count integer not null default 0 check (answer_count >= 0),
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_import_chunks (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer check (page_start is null or page_start >= 1),
  page_end integer check (page_end is null or page_end >= 1),
  raw_text text not null,
  classification text not null default 'unknown'
    check (classification in ('questions', 'answer_key', 'mixed', 'irrelevant', 'unknown')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_import_chunks_unique unique (import_job_id, chunk_index)
);

create table if not exists public.ai_import_questions (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  question_set_id uuid references public.ai_import_question_sets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_number text,
  global_index integer check (global_index is null or global_index > 0),
  question_text text not null,
  status text not null default 'extracted'
    check (status in ('extracted', 'missing_answer', 'answer_matched', 'needs_review', 'failed')),
  confidence numeric,
  source_page integer check (source_page is null or source_page >= 1),
  source_chunk_index integer check (source_chunk_index is null or source_chunk_index >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_import_answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.ai_import_questions(id) on delete cascade,
  import_job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_import_answer_key_candidates (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  question_set_id uuid references public.ai_import_question_sets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_chunk_index integer check (source_chunk_index is null or source_chunk_index >= 0),
  source_page_start integer check (source_page_start is null or source_page_start >= 1),
  source_page_end integer check (source_page_end is null or source_page_end >= 1),
  raw_text text not null,
  parsed_json jsonb,
  status text not null default 'detected'
    check (status in ('detected', 'parsed', 'matched', 'needs_review', 'failed')),
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_import_jobs_user_idx
  on public.ai_import_jobs (user_id, created_at desc);

create index if not exists ai_import_jobs_status_idx
  on public.ai_import_jobs (user_id, status, created_at desc);

create index if not exists ai_import_question_sets_job_idx
  on public.ai_import_question_sets (import_job_id, status);

create index if not exists ai_import_chunks_job_idx
  on public.ai_import_chunks (import_job_id, status, chunk_index);

create index if not exists ai_import_questions_job_idx
  on public.ai_import_questions (import_job_id, status, global_index);

create index if not exists ai_import_questions_set_idx
  on public.ai_import_questions (question_set_id, status);

create index if not exists ai_import_answer_options_question_idx
  on public.ai_import_answer_options (question_id);

create index if not exists ai_import_answer_keys_job_idx
  on public.ai_import_answer_key_candidates (import_job_id, status, source_chunk_index);

drop trigger if exists ai_import_jobs_set_updated_at on public.ai_import_jobs;
create trigger ai_import_jobs_set_updated_at
  before update on public.ai_import_jobs
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_import_question_sets_set_updated_at on public.ai_import_question_sets;
create trigger ai_import_question_sets_set_updated_at
  before update on public.ai_import_question_sets
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_import_chunks_set_updated_at on public.ai_import_chunks;
create trigger ai_import_chunks_set_updated_at
  before update on public.ai_import_chunks
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_import_questions_set_updated_at on public.ai_import_questions;
create trigger ai_import_questions_set_updated_at
  before update on public.ai_import_questions
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_import_answer_options_set_updated_at on public.ai_import_answer_options;
create trigger ai_import_answer_options_set_updated_at
  before update on public.ai_import_answer_options
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_import_answer_keys_set_updated_at on public.ai_import_answer_key_candidates;
create trigger ai_import_answer_keys_set_updated_at
  before update on public.ai_import_answer_key_candidates
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.ai_import_jobs enable row level security;
alter table public.ai_import_question_sets enable row level security;
alter table public.ai_import_chunks enable row level security;
alter table public.ai_import_questions enable row level security;
alter table public.ai_import_answer_options enable row level security;
alter table public.ai_import_answer_key_candidates enable row level security;

create policy "ai_import_jobs_owner_all"
  on public.ai_import_jobs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_import_question_sets_owner_all"
  on public.ai_import_question_sets
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_import_chunks_owner_all"
  on public.ai_import_chunks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_import_questions_owner_all"
  on public.ai_import_questions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_import_answer_options_owner_all"
  on public.ai_import_answer_options
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_import_answer_keys_owner_all"
  on public.ai_import_answer_key_candidates
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
