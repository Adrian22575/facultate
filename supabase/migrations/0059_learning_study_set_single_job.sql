create unique index if not exists ai_generation_jobs_learning_study_set_unique_idx
  on public.ai_generation_jobs (result_learning_study_set_id)
  where job_kind = 'learning_study_set'
    and result_learning_study_set_id is not null;
