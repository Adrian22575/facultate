create table if not exists public.learning_study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'uploaded',
      'extracting',
      'outlining',
      'generating',
      'consolidating',
      'ready',
      'ready_with_warnings',
      'failed',
      'archived'
    )),
  source_kind text not null default 'text'
    check (source_kind in ('text', 'pdf', 'docx', 'pptx', 'txt')),
  source_excerpt text,
  estimated_pages integer not null default 0 check (estimated_pages >= 0),
  chapter_count integer not null default 0 check (chapter_count >= 0),
  concept_count integer not null default 0 check (concept_count >= 0),
  flashcard_count integer not null default 0 check (flashcard_count >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  recommended_level text not null default 'mediu'
    check (recommended_level in ('usor', 'mediu', 'greu')),
  recommended_days integer not null default 1 check (recommended_days between 1 and 120),
  recommended_minutes_per_day integer not null default 30 check (recommended_minutes_per_day between 5 and 600),
  exam_date date,
  objective text,
  visibility_scope text not null default 'private'
    check (visibility_scope in ('private', 'cohort', 'program', 'institution')),
  target_cohort_id uuid references public.cohorts(id) on delete set null,
  target_unit_id uuid references public.academic_units(id) on delete set null,
  target_institution_id uuid references public.institutions(id) on delete set null,
  published_at timestamptz,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint learning_study_sets_warnings_array check (jsonb_typeof(warnings) = 'array')
);

create table if not exists public.learning_chapters (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  summary text not null default '',
  key_ideas jsonb not null default '[]'::jsonb,
  key_terms jsonb not null default '[]'::jsonb,
  source_hint text,
  confidence numeric(4, 3) not null default 0.75 check (confidence >= 0 and confidence <= 1),
  quality_status text not null default 'accepted'
    check (quality_status in ('accepted', 'needs_review', 'partial')),
  quality_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint learning_chapters_position_unique unique (study_set_id, position),
  constraint learning_chapters_key_ideas_array check (jsonb_typeof(key_ideas) = 'array'),
  constraint learning_chapters_key_terms_array check (jsonb_typeof(key_terms) = 'array')
);

create table if not exists public.learning_concepts (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  chapter_id uuid references public.learning_chapters(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  simple_explanation text not null default '',
  example text not null default '',
  analogy text not null default '',
  check_question text not null default '',
  confidence numeric(4, 3) not null default 0.75 check (confidence >= 0 and confidence <= 1),
  quality_status text not null default 'accepted'
    check (quality_status in ('accepted', 'needs_review', 'partial')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_flashcards (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  chapter_id uuid references public.learning_chapters(id) on delete cascade,
  concept_id uuid references public.learning_concepts(id) on delete set null,
  position integer not null check (position > 0),
  front text not null,
  back text not null,
  hint text not null default '',
  confidence numeric(4, 3) not null default 0.75 check (confidence >= 0 and confidence <= 1),
  quality_status text not null default 'accepted'
    check (quality_status in ('accepted', 'needs_review', 'partial')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  chapter_id uuid references public.learning_chapters(id) on delete cascade,
  concept_id uuid references public.learning_concepts(id) on delete set null,
  position integer not null check (position > 0),
  question_type text not null default 'multiple_choice'
    check (question_type in ('multiple_choice', 'true_false', 'open')),
  difficulty text not null default 'mediu'
    check (difficulty in ('usor', 'mediu', 'greu')),
  question_text text not null,
  answers jsonb not null default '[]'::jsonb,
  correct_index integer check (correct_index is null or correct_index >= 0),
  model_answer text not null default '',
  explanation text not null default '',
  confidence numeric(4, 3) not null default 0.75 check (confidence >= 0 and confidence <= 1),
  quality_status text not null default 'accepted'
    check (quality_status in ('accepted', 'needs_review', 'partial')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint learning_questions_answers_array check (jsonb_typeof(answers) = 'array')
);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'quick_test'
    check (mode in ('quick_test', 'custom_test', 'mistakes', 'flashcards')),
  score_percent integer check (score_percent is null or score_percent between 0 and 100),
  correct_count integer not null default 0 check (correct_count >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.learning_attempts(id) on delete cascade,
  question_id uuid references public.learning_questions(id) on delete set null,
  flashcard_id uuid references public.learning_flashcards(id) on delete set null,
  selected_index integer,
  is_correct boolean,
  rating text check (rating is null or rating in ('nu_stiu', 'aproape', 'stiu', 'mai_tarziu')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.learning_study_sets(id) on delete cascade,
  flashcard_id uuid not null references public.learning_flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('nu_stiu', 'aproape', 'stiu', 'mai_tarziu')),
  next_review_at timestamptz,
  review_count integer not null default 1 check (review_count >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint learning_flashcard_reviews_unique unique (flashcard_id, user_id)
);

create index if not exists learning_study_sets_user_status_idx
  on public.learning_study_sets (user_id, status, updated_at desc);

create index if not exists learning_study_sets_visibility_idx
  on public.learning_study_sets (visibility_scope, published_at desc, target_cohort_id, target_unit_id, target_institution_id);

create index if not exists learning_chapters_study_set_idx
  on public.learning_chapters (study_set_id, position);

create index if not exists learning_concepts_study_set_idx
  on public.learning_concepts (study_set_id, chapter_id, position);

create index if not exists learning_flashcards_study_set_idx
  on public.learning_flashcards (study_set_id, chapter_id, position);

create index if not exists learning_questions_study_set_idx
  on public.learning_questions (study_set_id, chapter_id, position);

create index if not exists learning_attempts_user_study_set_idx
  on public.learning_attempts (user_id, study_set_id, created_at desc);

create index if not exists learning_flashcard_reviews_next_idx
  on public.learning_flashcard_reviews (user_id, next_review_at);

drop trigger if exists learning_study_sets_set_updated_at on public.learning_study_sets;
create trigger learning_study_sets_set_updated_at
  before update on public.learning_study_sets
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists learning_chapters_set_updated_at on public.learning_chapters;
create trigger learning_chapters_set_updated_at
  before update on public.learning_chapters
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists learning_flashcard_reviews_set_updated_at on public.learning_flashcard_reviews;
create trigger learning_flashcard_reviews_set_updated_at
  before update on public.learning_flashcard_reviews
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.learning_study_sets enable row level security;
alter table public.learning_chapters enable row level security;
alter table public.learning_concepts enable row level security;
alter table public.learning_flashcards enable row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_attempt_items enable row level security;
alter table public.learning_flashcard_reviews enable row level security;

create or replace function public.can_access_learning_study_set(p_study_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.learning_study_sets s
    where s.id = p_study_set_id
      and (
        s.user_id = auth.uid()
        or (
          s.published_at is not null
          and s.visibility_scope <> 'private'
          and exists (
            select 1
            from public.memberships m
            where m.user_id = auth.uid()
              and m.status = 'active'
              and (
                (s.visibility_scope = 'cohort' and s.target_cohort_id is not null and m.cohort_id = s.target_cohort_id)
                or (s.visibility_scope = 'program' and s.target_unit_id is not null and m.program_unit_id = s.target_unit_id)
                or (s.visibility_scope = 'institution' and s.target_institution_id is not null and m.institution_id = s.target_institution_id)
              )
          )
        )
      )
  );
$$;

create policy "learning_study_sets_select_accessible"
  on public.learning_study_sets
  for select
  to authenticated
  using (public.can_access_learning_study_set(id));

create policy "learning_study_sets_insert_own"
  on public.learning_study_sets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "learning_study_sets_update_own"
  on public.learning_study_sets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "learning_children_select_accessible_chapters"
  on public.learning_chapters
  for select
  to authenticated
  using (public.can_access_learning_study_set(study_set_id));

create policy "learning_children_select_accessible_concepts"
  on public.learning_concepts
  for select
  to authenticated
  using (public.can_access_learning_study_set(study_set_id));

create policy "learning_children_select_accessible_flashcards"
  on public.learning_flashcards
  for select
  to authenticated
  using (public.can_access_learning_study_set(study_set_id));

create policy "learning_children_select_accessible_questions"
  on public.learning_questions
  for select
  to authenticated
  using (public.can_access_learning_study_set(study_set_id));

create policy "learning_attempts_select_own"
  on public.learning_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "learning_attempts_insert_own"
  on public.learning_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "learning_attempt_items_select_own"
  on public.learning_attempt_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.learning_attempts a
      where a.id = attempt_id
        and a.user_id = auth.uid()
    )
  );

create policy "learning_attempt_items_insert_own"
  on public.learning_attempt_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.learning_attempts a
      where a.id = attempt_id
        and a.user_id = auth.uid()
    )
  );

create policy "learning_flashcard_reviews_select_own"
  on public.learning_flashcard_reviews
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "learning_flashcard_reviews_insert_own"
  on public.learning_flashcard_reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "learning_flashcard_reviews_update_own"
  on public.learning_flashcard_reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
