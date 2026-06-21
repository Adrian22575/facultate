revoke all on function public.acquire_ai_generation_job_lock(uuid, timestamptz)
  from public, anon, authenticated;

revoke all on function public.release_ai_generation_job_lock(uuid)
  from public, anon, authenticated;

grant execute on function public.acquire_ai_generation_job_lock(uuid, timestamptz)
  to service_role;

grant execute on function public.release_ai_generation_job_lock(uuid)
  to service_role;
