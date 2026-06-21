alter table public.stripe_webhook_events
  add column if not exists started_at timestamptz,
  add column if not exists attempt_count integer not null default 0
    check (attempt_count >= 0);

update public.stripe_webhook_events
set started_at = coalesce(started_at, processed_at, timezone('utc', now()))
where status = 'processing'
  and started_at is null;

create index if not exists stripe_webhook_events_processing_started_idx
  on public.stripe_webhook_events (started_at)
  where status = 'processing';

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stale_after_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed boolean := false;
begin
  if length(trim(coalesce(p_event_id, ''))) not between 1 and 255
    or length(trim(coalesce(p_event_type, ''))) not between 1 and 255
    or p_stale_after_seconds not between 30 and 3600 then
    raise exception 'invalid_stripe_webhook_claim';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id,
    event_type,
    status,
    last_error,
    processed_at,
    started_at,
    attempt_count
  )
  values (
    p_event_id,
    p_event_type,
    'processing',
    null,
    null,
    timezone('utc', now()),
    1
  )
  on conflict (stripe_event_id) do update
  set event_type = excluded.event_type,
      status = 'processing',
      last_error = null,
      processed_at = null,
      started_at = excluded.started_at,
      attempt_count = public.stripe_webhook_events.attempt_count + 1
  where public.stripe_webhook_events.status = 'failed'
     or (
       public.stripe_webhook_events.status = 'processing'
       and coalesce(public.stripe_webhook_events.started_at, '-infinity'::timestamptz)
         <= timezone('utc', now()) - make_interval(secs => p_stale_after_seconds)
     )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, integer)
  to service_role;
