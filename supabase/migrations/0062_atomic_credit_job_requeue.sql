create or replace function public.requeue_credit_backed_generation_job(
  p_job_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
  v_balance integer;
  v_reserved integer;
begin
  if p_job_id is null or p_user_id is null then
    raise exception 'INVALID_GENERATION_JOB_REQUEUE_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('credit-backed-job:' || p_user_id::text, 0)
  );

  select job.*
  into v_job
  from public.ai_generation_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    raise exception 'GENERATION_JOB_NOT_FOUND';
  end if;

  if v_job.status in ('pending', 'processing') then
    return v_job.id;
  end if;

  if v_job.status <> 'failed' then
    raise exception 'GENERATION_JOB_NOT_RETRYABLE';
  end if;

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

  if v_balance - v_reserved < v_job.credit_cost then
    raise exception 'Nu ai suficiente incarcari disponibile pentru a relua procesarea.';
  end if;

  update public.ai_generation_jobs
  set status = 'pending',
      progress_percent = 0,
      error_message = null,
      completed_at = null,
      locked_at = null,
      started_at = null,
      last_heartbeat_at = null,
      last_progress_at = pg_catalog.now(),
      status_detail = 'Reluam procesarea materialului.',
      metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'manualRetryRequestedAt', pg_catalog.now(),
        'manualRetryCount', coalesce((metadata->>'manualRetryCount')::integer, 0) + 1
      )
  where id = p_job_id
    and user_id = p_user_id;

  return p_job_id;
end;
$$;

revoke execute on function public.requeue_credit_backed_generation_job(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.requeue_credit_backed_generation_job(uuid, uuid)
  to service_role;

create or replace function public.acquire_ai_generation_job_lock(
  p_job_id uuid,
  p_stale_before timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked boolean := false;
begin
  update public.ai_generation_jobs
  set locked_at = pg_catalog.now(),
      started_at = coalesce(started_at, pg_catalog.now()),
      last_heartbeat_at = pg_catalog.now(),
      processing_attempt_count = coalesce(processing_attempt_count, 0) + 1
  where id = p_job_id
    and status in ('pending', 'processing')
    and (locked_at is null or locked_at < p_stale_before);

  v_locked := found;
  return v_locked;
end;
$$;

revoke all on function public.acquire_ai_generation_job_lock(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.acquire_ai_generation_job_lock(uuid, timestamptz)
  to service_role;
