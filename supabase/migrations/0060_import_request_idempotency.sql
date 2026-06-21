create unique index if not exists ai_import_jobs_user_request_id_unique_idx
  on public.ai_import_jobs (user_id, (metadata ->> 'requestId'))
  where metadata ? 'requestId';
