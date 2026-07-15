alter table public.subject_progress
  add column if not exists mistake_question_ids jsonb not null default '[]'::jsonb;

alter table public.subject_progress
  drop constraint if exists subject_progress_mistake_question_ids_array;

alter table public.subject_progress
  add constraint subject_progress_mistake_question_ids_array
  check (jsonb_typeof(mistake_question_ids) = 'array');
