create table if not exists public.licenta_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  target_institution_id uuid references public.institutions(id) on delete set null,
  target_unit_id uuid references public.academic_units(id) on delete set null,
  target_cohort_id uuid references public.cohorts(id) on delete set null,
  user_type text check (user_type in ('student', 'elev')),
  mode text not null check (mode in ('quick', 'custom', 'mistakes', 'verify')),
  score_percent integer not null check (score_percent between 0 and 100),
  correct_count integer not null check (correct_count >= 0),
  question_count integer not null check (question_count > 0),
  wrong_count integer not null check (wrong_count >= 0),
  unanswered_count integer not null default 0 check (unanswered_count >= 0),
  question_ids jsonb not null default '[]'::jsonb,
  wrong_question_ids jsonb not null default '[]'::jsonb,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists licenta_exam_attempts_user_created_idx
  on public.licenta_exam_attempts (user_id, created_at desc);

create index if not exists licenta_exam_attempts_cohort_created_idx
  on public.licenta_exam_attempts (target_cohort_id, created_at desc)
  where target_cohort_id is not null;

create index if not exists licenta_exam_attempts_program_created_idx
  on public.licenta_exam_attempts (target_unit_id, created_at desc)
  where target_unit_id is not null;

create index if not exists licenta_exam_attempts_institution_created_idx
  on public.licenta_exam_attempts (target_institution_id, created_at desc)
  where target_institution_id is not null;

alter table public.licenta_exam_attempts enable row level security;

drop policy if exists "licenta_exam_attempts_select_own" on public.licenta_exam_attempts;
create policy "licenta_exam_attempts_select_own"
  on public.licenta_exam_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "licenta_exam_attempts_insert_own" on public.licenta_exam_attempts;
create policy "licenta_exam_attempts_insert_own"
  on public.licenta_exam_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);
