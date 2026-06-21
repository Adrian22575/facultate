alter table public.ai_import_jobs
  add column if not exists locked_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz;

create index if not exists ai_import_jobs_active_lock_idx
  on public.ai_import_jobs (locked_at, updated_at)
  where status in ('uploaded', 'extracting', 'chunking', 'processing', 'matching_answers');

create or replace function public.acquire_ai_import_job_lock(
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
  update public.ai_import_jobs
  set locked_at = pg_catalog.now(),
      last_heartbeat_at = pg_catalog.now()
  where id = p_job_id
    and status in (
      'uploaded', 'extracting', 'chunking', 'processing', 'matching_answers', 'failed'
    )
    and (locked_at is null or locked_at < p_stale_before);

  v_locked := found;
  return v_locked;
end;
$$;

create or replace function public.release_ai_import_job_lock(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_import_jobs
  set locked_at = null,
      last_heartbeat_at = pg_catalog.now()
  where id = p_job_id;
$$;

revoke all on function public.acquire_ai_import_job_lock(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_ai_import_job_lock(uuid)
  from public, anon, authenticated;
grant execute on function public.acquire_ai_import_job_lock(uuid, timestamptz)
  to service_role;
grant execute on function public.release_ai_import_job_lock(uuid)
  to service_role;
