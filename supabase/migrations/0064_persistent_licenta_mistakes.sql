create table if not exists public.licenta_exam_mistakes (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (
    pg_catalog.length(pg_catalog.btrim(question_id)) between 1 and 240
  ),
  first_wrong_at timestamptz not null default pg_catalog.now(),
  last_wrong_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, question_id)
);

create index if not exists licenta_exam_mistakes_user_updated_idx
  on public.licenta_exam_mistakes (user_id, updated_at desc);

alter table public.licenta_exam_mistakes enable row level security;

drop policy if exists "licenta_exam_mistakes_select_own" on public.licenta_exam_mistakes;
create policy "licenta_exam_mistakes_select_own"
  on public.licenta_exam_mistakes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

with exploded as (
  select
    attempt.user_id,
    question.value as question_id,
    attempt.created_at,
    attempt.id,
    exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(attempt.wrong_question_ids) as wrong(value)
      where wrong.value = question.value
    ) as is_wrong
  from public.licenta_exam_attempts as attempt
  cross join lateral pg_catalog.jsonb_array_elements_text(attempt.question_ids) as question(value)
),
latest as (
  select distinct on (user_id, question_id)
    user_id,
    question_id,
    created_at,
    is_wrong
  from exploded
  order by user_id, question_id, created_at desc, id desc
)
insert into public.licenta_exam_mistakes (
  user_id,
  question_id,
  first_wrong_at,
  last_wrong_at,
  updated_at
)
select user_id, question_id, created_at, created_at, created_at
from latest
where is_wrong
on conflict (user_id, question_id) do nothing;

create or replace function public.record_licenta_exam_attempt(
  p_user_id uuid,
  p_membership_id uuid,
  p_target_institution_id uuid,
  p_target_unit_id uuid,
  p_target_cohort_id uuid,
  p_user_type text,
  p_mode text,
  p_score_percent integer,
  p_correct_count integer,
  p_question_count integer,
  p_wrong_count integer,
  p_unanswered_count integer,
  p_question_ids jsonb,
  p_wrong_question_ids jsonb,
  p_duration_seconds integer,
  p_metadata jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt_id uuid;
begin
  if p_user_id is null
    or p_mode not in ('quick', 'custom', 'mistakes', 'verify')
    or p_user_type not in ('student', 'elev')
    or p_question_count < 1
    or p_correct_count < 0
    or p_wrong_count < 0
    or p_unanswered_count < 0
    or p_correct_count + p_wrong_count + p_unanswered_count <> p_question_count
    or p_score_percent <> pg_catalog.round((p_correct_count::numeric / p_question_count) * 100)::integer
    or pg_catalog.jsonb_typeof(p_question_ids) <> 'array'
    or pg_catalog.jsonb_typeof(p_wrong_question_ids) <> 'array'
    or pg_catalog.jsonb_array_length(p_question_ids) <> p_question_count
    or pg_catalog.jsonb_array_length(p_wrong_question_ids) <> p_wrong_count
    or p_idempotency_key is null
    or pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) < 8 then
    raise exception 'INVALID_LICENTA_ATTEMPT';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_wrong_question_ids) as wrong(value)
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(p_question_ids) as question(value)
      where question.value = wrong.value
    )
  ) then
    raise exception 'INVALID_LICENTA_MISTAKES';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('licenta-attempt:' || p_user_id::text, 0)
  );

  select attempt.id
  into v_attempt_id
  from public.licenta_exam_attempts as attempt
  where attempt.user_id = p_user_id
    and attempt.idempotency_key = p_idempotency_key;

  if v_attempt_id is not null then
    return pg_catalog.jsonb_build_object('attemptId', v_attempt_id, 'created', false);
  end if;

  insert into public.licenta_exam_attempts (
    user_id,
    membership_id,
    target_institution_id,
    target_unit_id,
    target_cohort_id,
    user_type,
    mode,
    score_percent,
    correct_count,
    question_count,
    wrong_count,
    unanswered_count,
    question_ids,
    wrong_question_ids,
    duration_seconds,
    metadata,
    idempotency_key
  )
  values (
    p_user_id,
    p_membership_id,
    p_target_institution_id,
    p_target_unit_id,
    p_target_cohort_id,
    p_user_type,
    p_mode,
    p_score_percent,
    p_correct_count,
    p_question_count,
    p_wrong_count,
    p_unanswered_count,
    p_question_ids,
    p_wrong_question_ids,
    p_duration_seconds,
    coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key
  )
  returning id into v_attempt_id;

  delete from public.licenta_exam_mistakes as mistake
  where mistake.user_id = p_user_id
    and mistake.question_id in (
      select question.value
      from pg_catalog.jsonb_array_elements_text(p_question_ids) as question(value)
    )
    and mistake.question_id not in (
      select wrong.value
      from pg_catalog.jsonb_array_elements_text(p_wrong_question_ids) as wrong(value)
    );

  insert into public.licenta_exam_mistakes (
    user_id,
    question_id,
    first_wrong_at,
    last_wrong_at,
    updated_at
  )
  select
    p_user_id,
    wrong.value,
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now()
  from pg_catalog.jsonb_array_elements_text(p_wrong_question_ids) as wrong(value)
  on conflict (user_id, question_id)
  do update set
    last_wrong_at = excluded.last_wrong_at,
    updated_at = excluded.updated_at;

  return pg_catalog.jsonb_build_object('attemptId', v_attempt_id, 'created', true);
end;
$$;

revoke execute on function public.record_licenta_exam_attempt(
  uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, integer,
  integer, integer, jsonb, jsonb, integer, jsonb, text
) from public, anon, authenticated;
grant execute on function public.record_licenta_exam_attempt(
  uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, integer,
  integer, integer, jsonb, jsonb, integer, jsonb, text
) to service_role;
