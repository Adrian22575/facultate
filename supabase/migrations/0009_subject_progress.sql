create table if not exists public.subject_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  study_total_questions integer not null default 0 check (study_total_questions >= 0),
  study_viewed_question_ids jsonb not null default '[]'::jsonb,
  study_viewed_count integer not null default 0 check (study_viewed_count >= 0),
  interactive_total_questions integer not null default 0 check (interactive_total_questions >= 0),
  interactive_answered integer not null default 0 check (interactive_answered >= 0),
  interactive_correct integer not null default 0 check (interactive_correct >= 0),
  interactive_wrong integer not null default 0 check (interactive_wrong >= 0),
  test_best_score_percent integer not null default 0 check (test_best_score_percent between 0 and 100),
  test_last_score_percent integer not null default 0 check (test_last_score_percent between 0 and 100),
  last_mode text check (last_mode in ('studiu', 'interactiv', 'test')),
  last_activity_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subject_progress_user_subject_unique unique (user_id, subject_id)
);

create index if not exists subject_progress_user_activity_idx
  on public.subject_progress (user_id, last_activity_at desc);

drop trigger if exists subject_progress_set_updated_at on public.subject_progress;
create trigger subject_progress_set_updated_at
  before update on public.subject_progress
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.subject_progress enable row level security;

drop policy if exists "subject_progress_select_own" on public.subject_progress;
create policy "subject_progress_select_own"
  on public.subject_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "subject_progress_insert_own" on public.subject_progress;
create policy "subject_progress_insert_own"
  on public.subject_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "subject_progress_update_own" on public.subject_progress;
create policy "subject_progress_update_own"
  on public.subject_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
