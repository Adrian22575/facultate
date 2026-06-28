create table if not exists public.user_question_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('question_bank_item', 'generated_test_question')),
  source_question_id uuid not null,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  question_text text not null,
  answers jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  explanation text not null default '',
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_question_corrections_answers_array check (jsonb_typeof(answers) = 'array'),
  constraint user_question_corrections_unique unique (user_id, source_type, source_question_id)
);

create index if not exists user_question_corrections_user_idx
  on public.user_question_corrections (user_id, updated_at desc);

create index if not exists user_question_corrections_source_idx
  on public.user_question_corrections (source_type, source_question_id);

drop trigger if exists user_question_corrections_set_updated_at on public.user_question_corrections;
create trigger user_question_corrections_set_updated_at
  before update on public.user_question_corrections
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.user_question_corrections enable row level security;

drop policy if exists "user_question_corrections_select_own" on public.user_question_corrections;
create policy "user_question_corrections_select_own"
  on public.user_question_corrections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_question_corrections_insert_own" on public.user_question_corrections;
create policy "user_question_corrections_insert_own"
  on public.user_question_corrections
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_question_corrections_update_own" on public.user_question_corrections;
create policy "user_question_corrections_update_own"
  on public.user_question_corrections
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_question_corrections_delete_own" on public.user_question_corrections;
create policy "user_question_corrections_delete_own"
  on public.user_question_corrections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
