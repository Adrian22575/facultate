create or replace function public.create_credit_backed_generation_job(
  p_user_id uuid,
  p_source_document_id uuid,
  p_job_kind text,
  p_status_detail text,
  p_result_learning_study_set_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balance integer;
  v_reserved integer;
  v_job_id uuid;
begin
  if p_user_id is null or p_job_kind not in ('legacy_generate_test', 'question_bank_extract', 'learning_study_set') then
    raise exception 'INVALID_GENERATION_JOB_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('credit-backed-job:' || p_user_id::text, 0)
  );

  select coalesce(sum(ledger.delta), 0)::integer
  into v_balance
  from public.ai_credit_ledger as ledger
  where ledger.user_id = p_user_id;

  select coalesce(sum(job.credit_cost), 0)::integer
  into v_reserved
  from public.ai_generation_jobs as job
  where job.user_id = p_user_id
    and job.status in ('pending', 'processing')
    and job.credit_cost > 0;

  if v_balance - v_reserved < 1 then
    raise exception 'Nu ai suficiente incarcari disponibile pentru o alta procesare activa.';
  end if;

  insert into public.ai_generation_jobs (
    user_id,
    source_document_id,
    status,
    credit_cost,
    job_kind,
    stage,
    progress_percent,
    status_detail,
    result_learning_study_set_id,
    last_progress_at,
    metadata
  )
  values (
    p_user_id,
    p_source_document_id,
    'pending',
    1,
    p_job_kind,
    'queued',
    0,
    p_status_detail,
    p_result_learning_study_set_id,
    pg_catalog.now(),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke execute on function public.create_credit_backed_generation_job(
  uuid, uuid, text, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_credit_backed_generation_job(
  uuid, uuid, text, text, uuid, jsonb
) to service_role;
