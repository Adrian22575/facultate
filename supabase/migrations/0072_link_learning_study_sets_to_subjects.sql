alter table public.learning_study_sets
  add column if not exists subject_id text references public.subjects(id) on delete set null;

create index if not exists learning_study_sets_subject_access_idx
  on public.learning_study_sets (subject_id, status, updated_at desc)
  where subject_id is not null and status <> 'archived';
