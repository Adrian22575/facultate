alter table public.ai_generation_jobs
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists last_progress_at timestamptz,
  add column if not exists processing_attempt_count integer not null default 0 check (processing_attempt_count >= 0);

create index if not exists ai_generation_jobs_last_heartbeat_idx
  on public.ai_generation_jobs (last_heartbeat_at desc)
  where status in ('pending', 'processing');

create index if not exists ai_generation_jobs_last_progress_idx
  on public.ai_generation_jobs (last_progress_at desc)
  where status in ('pending', 'processing');

create or replace function public.acquire_ai_generation_job_lock(
  p_job_id uuid,
  p_stale_before timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean := false;
begin
  update public.ai_generation_jobs
  set locked_at = timezone('utc', now()),
      started_at = coalesce(started_at, timezone('utc', now())),
      last_heartbeat_at = timezone('utc', now()),
      processing_attempt_count = coalesce(processing_attempt_count, 0) + 1
  where id = p_job_id
    and status in ('pending', 'processing', 'failed')
    and (locked_at is null or locked_at < p_stale_before);

  v_locked := found;
  return v_locked;
end;
$$;
