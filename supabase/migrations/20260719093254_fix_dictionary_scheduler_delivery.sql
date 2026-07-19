create or replace function private.invoke_editorial_scheduler()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, vault
as $$
declare
  scheduler_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into scheduler_secret
  from vault.decrypted_secrets
  where name = 'editorial_scheduler_token'
  limit 1;

  if coalesce(scheduler_secret, '') = '' then
    raise exception 'editorial_scheduler_token is not configured';
  end if;

  select net.http_get(
    url := 'https://www.nota5plus.ro/api/cron/dictionary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || scheduler_secret
    ),
    timeout_milliseconds := 20000
  )
  into request_id;

  if request_id is null then
    raise exception 'editorial scheduler request was not queued';
  end if;
end;
$$;

revoke all on function private.invoke_editorial_scheduler() from public;

comment on function private.invoke_editorial_scheduler() is
  'Invoca prin GET ruta comuna de automatizare; esueaza explicit cand configurarea lipseste.';
