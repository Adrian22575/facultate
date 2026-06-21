alter table public.ai_generation_jobs
  drop constraint if exists ai_generation_jobs_job_kind_check;

alter table public.ai_generation_jobs
  add constraint ai_generation_jobs_job_kind_check
  check (job_kind in ('legacy_generate_test', 'question_bank_extract', 'learning_study_set'));

alter table public.learning_study_sets
  add column if not exists job_id uuid references public.ai_generation_jobs(id) on delete set null;

alter table public.ai_generation_jobs
  add column if not exists result_learning_study_set_id uuid references public.learning_study_sets(id) on delete set null;

create index if not exists learning_study_sets_job_id_idx
  on public.learning_study_sets (job_id);

create index if not exists ai_generation_jobs_result_learning_study_set_idx
  on public.ai_generation_jobs (result_learning_study_set_id);

create index if not exists ai_generation_jobs_learning_active_idx
  on public.ai_generation_jobs (user_id, status, created_at desc)
  where job_kind = 'learning_study_set';
