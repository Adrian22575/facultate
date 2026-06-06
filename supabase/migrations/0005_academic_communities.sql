alter table public.profiles
  add column if not exists user_type text check (user_type in ('student', 'elev')),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists primary_membership_id uuid;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  institution_type text not null check (institution_type in ('university', 'school')),
  name text not null,
  city text,
  county text,
  source text not null default 'user' check (source in ('seed', 'user', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.academic_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  parent_unit_id uuid references public.academic_units(id) on delete cascade,
  unit_type text not null check (unit_type in ('faculty', 'program', 'profile')),
  name text not null,
  source text not null default 'user' check (source in ('seed', 'user', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  program_unit_id uuid references public.academic_units(id) on delete set null,
  cohort_type text not null check (cohort_type in ('student_group', 'school_class')),
  label text not null,
  study_year_label text,
  group_label text,
  source text not null default 'user' check (source in ('seed', 'user', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  program_unit_id uuid references public.academic_units(id) on delete set null,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  membership_role text not null default 'member' check (membership_role in ('member', 'teacher', 'owner')),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint memberships_user_cohort_unique unique (user_id, cohort_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_primary_membership_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_primary_membership_id_fkey
      foreign key (primary_membership_id)
      references public.memberships(id)
      on delete set null;
  end if;
end $$;

alter table public.user_generated_tests
  add column if not exists visibility_scope text not null default 'private'
    check (visibility_scope in ('private', 'cohort', 'program', 'institution')),
  add column if not exists target_cohort_id uuid references public.cohorts(id) on delete set null,
  add column if not exists target_unit_id uuid references public.academic_units(id) on delete set null,
  add column if not exists target_institution_id uuid references public.institutions(id) on delete set null;

create index if not exists institutions_lookup_idx
  on public.institutions (institution_type, lower(name));

create index if not exists academic_units_lookup_idx
  on public.academic_units (institution_id, unit_type, lower(name));

create index if not exists cohorts_lookup_idx
  on public.cohorts (institution_id, cohort_type, lower(label));

create index if not exists memberships_primary_idx
  on public.memberships (user_id, is_primary, status);

create index if not exists user_generated_tests_visibility_idx
  on public.user_generated_tests (status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id);

drop trigger if exists institutions_set_updated_at on public.institutions;
create trigger institutions_set_updated_at
  before update on public.institutions
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists academic_units_set_updated_at on public.academic_units;
create trigger academic_units_set_updated_at
  before update on public.academic_units
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists cohorts_set_updated_at on public.cohorts;
create trigger cohorts_set_updated_at
  before update on public.cohorts
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.institutions enable row level security;
alter table public.academic_units enable row level security;
alter table public.cohorts enable row level security;
alter table public.memberships enable row level security;

drop policy if exists "institutions_select_all" on public.institutions;
create policy "institutions_select_all"
  on public.institutions
  for select
  to authenticated
  using (true);

drop policy if exists "institutions_insert_authenticated" on public.institutions;
create policy "institutions_insert_authenticated"
  on public.institutions
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "institutions_update_creator" on public.institutions;
create policy "institutions_update_creator"
  on public.institutions
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "academic_units_select_all" on public.academic_units;
create policy "academic_units_select_all"
  on public.academic_units
  for select
  to authenticated
  using (true);

drop policy if exists "academic_units_insert_authenticated" on public.academic_units;
create policy "academic_units_insert_authenticated"
  on public.academic_units
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "academic_units_update_creator" on public.academic_units;
create policy "academic_units_update_creator"
  on public.academic_units
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "cohorts_select_all" on public.cohorts;
create policy "cohorts_select_all"
  on public.cohorts
  for select
  to authenticated
  using (true);

drop policy if exists "cohorts_insert_authenticated" on public.cohorts;
create policy "cohorts_insert_authenticated"
  on public.cohorts
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "cohorts_update_creator" on public.cohorts;
create policy "cohorts_update_creator"
  on public.cohorts
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "memberships_select_own" on public.memberships;
create policy "memberships_select_own"
  on public.memberships
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "memberships_insert_own" on public.memberships;
create policy "memberships_insert_own"
  on public.memberships
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "memberships_update_own" on public.memberships;
create policy "memberships_update_own"
  on public.memberships
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_generated_tests_select_own" on public.user_generated_tests;
drop policy if exists "user_generated_tests_select_accessible" on public.user_generated_tests;
create policy "user_generated_tests_select_accessible"
  on public.user_generated_tests
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      status = 'active'
      and visibility_scope = 'cohort'
      and target_cohort_id is not null
      and exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.is_primary = true
          and m.cohort_id = target_cohort_id
      )
    )
    or (
      status = 'active'
      and visibility_scope = 'program'
      and target_unit_id is not null
      and exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.is_primary = true
          and m.program_unit_id = target_unit_id
      )
    )
    or (
      status = 'active'
      and visibility_scope = 'institution'
      and target_institution_id is not null
      and exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.status = 'active'
          and m.is_primary = true
          and m.institution_id = target_institution_id
      )
    )
  );

drop policy if exists "user_generated_test_questions_select_own" on public.user_generated_test_questions;
drop policy if exists "user_generated_test_questions_select_accessible" on public.user_generated_test_questions;
create policy "user_generated_test_questions_select_accessible"
  on public.user_generated_test_questions
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.user_generated_tests t
      where t.id = test_id
        and (
          t.user_id = auth.uid()
          or (
            t.status = 'active'
            and t.visibility_scope = 'cohort'
            and t.target_cohort_id is not null
            and exists (
              select 1
              from public.memberships m
              where m.user_id = auth.uid()
                and m.status = 'active'
                and m.is_primary = true
                and m.cohort_id = t.target_cohort_id
            )
          )
          or (
            t.status = 'active'
            and t.visibility_scope = 'program'
            and t.target_unit_id is not null
            and exists (
              select 1
              from public.memberships m
              where m.user_id = auth.uid()
                and m.status = 'active'
                and m.is_primary = true
                and m.program_unit_id = t.target_unit_id
            )
          )
          or (
            t.status = 'active'
            and t.visibility_scope = 'institution'
            and t.target_institution_id is not null
            and exists (
              select 1
              from public.memberships m
              where m.user_id = auth.uid()
                and m.status = 'active'
                and m.is_primary = true
                and m.institution_id = t.target_institution_id
            )
          )
        )
    )
  );

create or replace function public.create_generated_test_draft(
  p_user_id uuid,
  p_source_document_id uuid,
  p_title text,
  p_prompt_version text,
  p_questions jsonb,
  p_credit_cost integer default 1,
  p_visibility_scope text default 'private',
  p_target_cohort_id uuid default null,
  p_target_unit_id uuid default null,
  p_target_institution_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_id uuid;
  v_question jsonb;
  v_position integer := 0;
  v_credit_balance integer;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'QUESTIONS_REQUIRED';
  end if;

  if p_source_document_id is not null and not exists (
    select 1
    from public.ai_source_documents
    where id = p_source_document_id
      and user_id = p_user_id
  ) then
    raise exception 'INVALID_SOURCE_DOCUMENT';
  end if;

  if p_visibility_scope not in ('private', 'cohort', 'program', 'institution') then
    raise exception 'INVALID_VISIBILITY_SCOPE';
  end if;

  if p_visibility_scope = 'cohort' and (
    p_target_cohort_id is null
    or not exists (
      select 1
      from public.memberships
      where user_id = p_user_id
        and status = 'active'
        and cohort_id = p_target_cohort_id
    )
  ) then
    raise exception 'INVALID_TARGET_COHORT';
  end if;

  if p_visibility_scope = 'program' and (
    p_target_unit_id is null
    or not exists (
      select 1
      from public.memberships
      where user_id = p_user_id
        and status = 'active'
        and program_unit_id = p_target_unit_id
    )
  ) then
    raise exception 'INVALID_TARGET_PROGRAM';
  end if;

  if p_visibility_scope = 'institution' and (
    p_target_institution_id is null
    or not exists (
      select 1
      from public.memberships
      where user_id = p_user_id
        and status = 'active'
        and institution_id = p_target_institution_id
    )
  ) then
    raise exception 'INVALID_TARGET_INSTITUTION';
  end if;

  v_credit_balance := public.get_ai_credit_balance(p_user_id);
  if v_credit_balance < p_credit_cost then
    raise exception 'INSUFFICIENT_AI_CREDITS';
  end if;

  insert into public.user_generated_tests (
    user_id,
    source_document_id,
    title,
    status,
    prompt_version,
    total_questions,
    visibility_scope,
    target_cohort_id,
    target_unit_id,
    target_institution_id
  )
  values (
    p_user_id,
    p_source_document_id,
    p_title,
    'draft',
    p_prompt_version,
    jsonb_array_length(p_questions),
    p_visibility_scope,
    p_target_cohort_id,
    p_target_unit_id,
    p_target_institution_id
  )
  returning id into v_test_id;

  for v_question in select * from jsonb_array_elements(p_questions)
  loop
    v_position := v_position + 1;

    insert into public.user_generated_test_questions (
      test_id,
      user_id,
      position,
      question_text,
      answers,
      correct_index,
      explanation
    )
    values (
      v_test_id,
      p_user_id,
      coalesce((v_question ->> 'position')::integer, v_position),
      v_question ->> 'question_text',
      v_question -> 'answers',
      (v_question ->> 'correct_index')::integer,
      coalesce(v_question ->> 'explanation', '')
    );
  end loop;

  insert into public.ai_credit_ledger (
    user_id,
    source,
    reason,
    delta,
    metadata
  )
  values (
    p_user_id,
    'generation',
    'generation_consume',
    -p_credit_cost,
    jsonb_build_object(
      'generated_test_id', v_test_id,
      'source_document_id', p_source_document_id,
      'prompt_version', p_prompt_version,
      'visibility_scope', p_visibility_scope,
      'target_cohort_id', p_target_cohort_id,
      'target_unit_id', p_target_unit_id,
      'target_institution_id', p_target_institution_id
    )
  );

  return v_test_id;
end;
$$;
