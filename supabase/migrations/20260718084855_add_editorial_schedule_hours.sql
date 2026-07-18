alter table public.editorial_automation_settings
  add column if not exists scheduled_hour smallint not null default 10;

alter table public.editorial_automation_settings
  drop constraint if exists editorial_automation_settings_scheduled_hour_check;

alter table public.editorial_automation_settings
  add constraint editorial_automation_settings_scheduled_hour_check
  check (scheduled_hour between 0 and 23);

comment on column public.editorial_automation_settings.scheduled_hour is
  'Ora de pornire în Europe/Bucharest pentru rularea automată.';

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

create or replace function public.configure_editorial_scheduler_token(scheduler_secret text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, vault
as $$
declare
  stored_secret text;
begin
  if length(coalesce(scheduler_secret, '')) < 24 then
    raise exception 'scheduler secret is invalid';
  end if;

  select decrypted_secret
  into stored_secret
  from vault.decrypted_secrets
  where name = 'editorial_scheduler_token'
  limit 1;

  if stored_secret = scheduler_secret then
    return;
  end if;

  delete from vault.secrets where name = 'editorial_scheduler_token';
  perform vault.create_secret(scheduler_secret, 'editorial_scheduler_token');
end;
$$;

revoke all on function public.configure_editorial_scheduler_token(text) from public;
grant execute on function public.configure_editorial_scheduler_token(text) to service_role;

create or replace function private.invoke_editorial_scheduler()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, vault
as $$
declare
  scheduler_secret text;
begin
  select decrypted_secret
  into scheduler_secret
  from vault.decrypted_secrets
  where name = 'editorial_scheduler_token'
  limit 1;

  if coalesce(scheduler_secret, '') = '' then
    raise warning 'editorial_scheduler_token is not configured';
    return;
  end if;

  perform net.http_post(
    url := 'https://www.nota5plus.ro/api/cron/dictionary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || scheduler_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function private.invoke_editorial_scheduler() from public;

do $$
declare
  previous_job_id bigint;
begin
  select jobid
  into previous_job_id
  from cron.job
  where jobname = 'editorial_scheduler_hourly'
  limit 1;

  if previous_job_id is not null then
    perform cron.unschedule(previous_job_id);
  end if;

  perform cron.schedule(
    'editorial_scheduler_hourly',
    '0 * * * *',
    'select private.invoke_editorial_scheduler();'
  );
end;
$$;
