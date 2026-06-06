alter table public.user_generated_tests
  add column if not exists exam_type text not null default 'normal'
    check (exam_type in ('normal', 'licenta')),
  add column if not exists semester smallint check (semester in (1, 2)),
  add column if not exists student_year smallint check (student_year between 1 and 10),
  add column if not exists school_class text,
  add column if not exists subject_id text,
  add column if not exists subject_name text;

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
  p_target_institution_id uuid default null,
  p_exam_type text default 'normal',
  p_semester smallint default null,
  p_student_year smallint default null,
  p_school_class text default null,
  p_subject_id text default null,
  p_subject_name text default null
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

  if p_exam_type not in ('normal', 'licenta') then
    raise exception 'INVALID_EXAM_TYPE';
  end if;

  if p_semester is not null and p_semester not in (1, 2) then
    raise exception 'INVALID_SEMESTER';
  end if;

  if p_student_year is not null and (p_student_year < 1 or p_student_year > 10) then
    raise exception 'INVALID_STUDENT_YEAR';
  end if;

  if p_subject_id = 'custom' and nullif(trim(coalesce(p_subject_name, '')), '') is null then
    raise exception 'SUBJECT_NAME_REQUIRED';
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
    target_institution_id,
    exam_type,
    semester,
    student_year,
    school_class,
    subject_id,
    subject_name
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
    p_target_institution_id,
    p_exam_type,
    p_semester,
    p_student_year,
    nullif(trim(coalesce(p_school_class, '')), ''),
    nullif(trim(coalesce(p_subject_id, '')), ''),
    nullif(trim(coalesce(p_subject_name, '')), '')
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
      'target_institution_id', p_target_institution_id,
      'exam_type', p_exam_type,
      'semester', p_semester,
      'student_year', p_student_year,
      'school_class', p_school_class,
      'subject_id', p_subject_id,
      'subject_name', p_subject_name
    )
  );

  return v_test_id;
end;
$$;
