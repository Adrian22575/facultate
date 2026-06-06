create table if not exists public.ai_question_banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  title text not null,
  status text not null default 'processing' check (status in ('processing', 'published', 'failed', 'archived')),
  processing_profile text not null default 'small' check (processing_profile in ('small', 'medium', 'large')),
  question_count integer not null default 0 check (question_count >= 0),
  published_at timestamptz,
  exam_type text not null default 'normal' check (exam_type in ('normal', 'licenta')),
  subject_id text,
  subject_name text,
  visibility_scope text not null default 'cohort' check (visibility_scope in ('private', 'cohort', 'program', 'institution')),
  target_cohort_id uuid references public.cohorts(id) on delete set null,
  target_unit_id uuid references public.academic_units(id) on delete set null,
  target_institution_id uuid references public.institutions(id) on delete set null,
  semester smallint check (semester in (1, 2)),
  student_year smallint check (student_year between 1 and 10),
  school_class text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_generation_job_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_generation_jobs(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'succeeded', 'failed')),
  source_start integer check (source_start is null or source_start >= 0),
  source_end integer check (source_end is null or source_end >= 0),
  estimated_items integer not null default 0 check (estimated_items >= 0),
  model_profile text,
  reasoning_effort text,
  extracted_items_count integer not null default 0 check (extracted_items_count >= 0),
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_generation_job_chunks_unique unique (job_id, chunk_index)
);

create table if not exists public.ai_question_bank_items (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.ai_question_banks(id) on delete cascade,
  position integer not null check (position > 0),
  question_text text not null,
  answers jsonb not null,
  correct_index integer not null check (correct_index >= 0 and correct_index <= 3),
  explanation text not null default '',
  source_chunk_id uuid,
  source_page integer,
  normalized_hash text not null,
  quality_status text not null default 'accepted' check (quality_status in ('accepted', 'retry', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_question_bank_items_answers_array check (jsonb_typeof(answers) = 'array'),
  constraint ai_question_bank_items_position_unique unique (bank_id, position)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_question_bank_items_source_chunk_fk'
  ) then
    alter table public.ai_question_bank_items
      add constraint ai_question_bank_items_source_chunk_fk
      foreign key (source_chunk_id)
      references public.ai_generation_job_chunks(id)
      on delete set null;
  end if;
end
$$;

alter table public.ai_generation_jobs
  add column if not exists job_kind text not null default 'legacy_generate_test'
    check (job_kind in ('legacy_generate_test', 'question_bank_extract')),
  add column if not exists stage text not null default 'queued',
  add column if not exists progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  add column if not exists processing_profile text,
  add column if not exists routing_mode text,
  add column if not exists status_detail text,
  add column if not exists result_bank_id uuid references public.ai_question_banks(id) on delete set null,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists locked_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_question_banks_user_id_idx
  on public.ai_question_banks (user_id, published_at desc);

create index if not exists ai_question_banks_subject_exam_idx
  on public.ai_question_banks (subject_id, exam_type, published_at desc)
  where status = 'published';

create index if not exists ai_question_banks_visibility_idx
  on public.ai_question_banks (status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id);

create index if not exists ai_generation_jobs_job_kind_idx
  on public.ai_generation_jobs (job_kind, status, created_at desc);

create index if not exists ai_generation_jobs_result_bank_idx
  on public.ai_generation_jobs (result_bank_id);

create index if not exists ai_generation_job_chunks_status_idx
  on public.ai_generation_job_chunks (job_id, status, chunk_index);

create index if not exists ai_question_bank_items_bank_idx
  on public.ai_question_bank_items (bank_id, position);

create index if not exists ai_question_bank_items_hash_idx
  on public.ai_question_bank_items (normalized_hash);

drop trigger if exists ai_question_banks_set_updated_at on public.ai_question_banks;
create trigger ai_question_banks_set_updated_at
  before update on public.ai_question_banks
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_generation_job_chunks_set_updated_at on public.ai_generation_job_chunks;
create trigger ai_generation_job_chunks_set_updated_at
  before update on public.ai_generation_job_chunks
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.ai_question_banks enable row level security;
alter table public.ai_question_bank_items enable row level security;
alter table public.ai_generation_job_chunks enable row level security;

create policy "ai_question_banks_select_own"
  on public.ai_question_banks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_generation_job_chunks_select_own"
  on public.ai_generation_job_chunks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_generation_jobs j
      where j.id = job_id
        and j.user_id = auth.uid()
    )
  );

create policy "ai_question_bank_items_select_own"
  on public.ai_question_bank_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_question_banks b
      where b.id = bank_id
        and b.user_id = auth.uid()
    )
  );

create or replace function public.acquire_ai_generation_job_lock(
  p_job_id uuid,
  p_stale_before timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean := false;
begin
  update public.ai_generation_jobs
  set locked_at = timezone('utc', now()),
      started_at = coalesce(started_at, timezone('utc', now()))
  where id = p_job_id
    and status in ('pending', 'processing', 'failed')
    and (locked_at is null or locked_at < p_stale_before);

  v_locked := found;
  return v_locked;
end;
$$;

create or replace function public.release_ai_generation_job_lock(
  p_job_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_generation_jobs
  set locked_at = null
  where id = p_job_id;
$$;
