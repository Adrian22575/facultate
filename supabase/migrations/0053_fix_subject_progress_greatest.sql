create or replace function public.sync_subject_progress(
  p_user_id uuid,
  p_subject_id text,
  p_mode text,
  p_study_total_questions integer,
  p_study_viewed_indexes jsonb,
  p_interactive_total_questions integer,
  p_interactive_answered integer,
  p_interactive_correct integer,
  p_interactive_wrong integer,
  p_test_score_percent integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.subject_progress%rowtype;
  v_merged_indexes jsonb := '[]'::jsonb;
  v_previous_best integer := 0;
begin
  if p_mode not in ('studiu', 'interactiv', 'test') then
    raise exception 'INVALID_PROGRESS_MODE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_subject_id, 0)
  );

  insert into public.subject_progress (user_id, subject_id, last_mode, last_activity_at)
  values (p_user_id, p_subject_id, p_mode, pg_catalog.timezone('utc', pg_catalog.now()))
  on conflict (user_id, subject_id) do nothing;

  select *
  into v_existing
  from public.subject_progress
  where user_id = p_user_id
    and subject_id = p_subject_id
  for update;

  if not found then
    raise exception 'SUBJECT_PROGRESS_NOT_FOUND';
  end if;

  v_previous_best := coalesce(v_existing.test_best_score_percent, 0);

  if p_mode = 'studiu' then
    if p_study_total_questions is null or p_study_total_questions < 0 then
      raise exception 'INVALID_STUDY_PROGRESS';
    end if;

    select coalesce(pg_catalog.jsonb_agg(index_value order by index_value), '[]'::jsonb)
    into v_merged_indexes
    from (
      select distinct value::integer as index_value
      from pg_catalog.jsonb_array_elements_text(
        coalesce(v_existing.study_viewed_question_ids, '[]'::jsonb) ||
        coalesce(p_study_viewed_indexes, '[]'::jsonb)
      ) as source(value)
      where value ~ '^[0-9]+$'
    ) as merged;

    update public.subject_progress
    set study_total_questions = greatest(study_total_questions, p_study_total_questions),
        study_viewed_question_ids = v_merged_indexes,
        study_viewed_count = pg_catalog.jsonb_array_length(v_merged_indexes),
        last_mode = p_mode,
        last_activity_at = pg_catalog.timezone('utc', pg_catalog.now())
    where user_id = p_user_id
      and subject_id = p_subject_id;
  elsif p_mode = 'interactiv' then
    if p_interactive_total_questions is null
      or p_interactive_answered is null
      or p_interactive_correct is null
      or p_interactive_wrong is null
      or p_interactive_total_questions < 0
      or p_interactive_answered < 0
      or p_interactive_correct < 0
      or p_interactive_wrong < 0
      or p_interactive_answered > p_interactive_total_questions
      or p_interactive_correct + p_interactive_wrong <> p_interactive_answered then
      raise exception 'INVALID_INTERACTIVE_PROGRESS';
    end if;

    update public.subject_progress
    set interactive_total_questions = greatest(
          interactive_total_questions,
          p_interactive_total_questions
        ),
        interactive_answered = case
          when p_interactive_answered > interactive_answered
            or (p_interactive_answered = interactive_answered and p_interactive_correct > interactive_correct)
            then p_interactive_answered
          else interactive_answered
        end,
        interactive_correct = case
          when p_interactive_answered > interactive_answered
            or (p_interactive_answered = interactive_answered and p_interactive_correct > interactive_correct)
            then p_interactive_correct
          else interactive_correct
        end,
        interactive_wrong = case
          when p_interactive_answered > interactive_answered
            or (p_interactive_answered = interactive_answered and p_interactive_correct > interactive_correct)
            then p_interactive_wrong
          else interactive_wrong
        end,
        last_mode = p_mode,
        last_activity_at = pg_catalog.timezone('utc', pg_catalog.now())
    where user_id = p_user_id
      and subject_id = p_subject_id;
  else
    if p_test_score_percent is null or p_test_score_percent < 0 or p_test_score_percent > 100 then
      raise exception 'INVALID_TEST_PROGRESS';
    end if;

    update public.subject_progress
    set test_last_score_percent = p_test_score_percent,
        test_best_score_percent = greatest(test_best_score_percent, p_test_score_percent),
        last_mode = p_mode,
        last_activity_at = pg_catalog.timezone('utc', pg_catalog.now())
    where user_id = p_user_id
      and subject_id = p_subject_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'previousBestScore', v_previous_best,
    'mode', p_mode
  );
end;
$$;

revoke execute on function public.sync_subject_progress(
  uuid, text, text, integer, jsonb, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.sync_subject_progress(
  uuid, text, text, integer, jsonb, integer, integer, integer, integer, integer
) to service_role;
