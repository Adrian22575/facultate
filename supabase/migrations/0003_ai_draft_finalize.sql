create or replace function public.create_generated_test_draft(
  p_user_id uuid,
  p_source_document_id uuid,
  p_title text,
  p_prompt_version text,
  p_questions jsonb,
  p_credit_cost integer default 1
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
    total_questions
  )
  values (
    p_user_id,
    p_source_document_id,
    p_title,
    'draft',
    p_prompt_version,
    jsonb_array_length(p_questions)
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
      'prompt_version', p_prompt_version
    )
  );

  return v_test_id;
end;
$$;
