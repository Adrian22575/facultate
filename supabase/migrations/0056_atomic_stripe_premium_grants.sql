create or replace function public.apply_stripe_premium_grant(
  p_user_id uuid,
  p_plan_code text,
  p_duration_hours integer,
  p_session_id text,
  p_payment_intent_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.premium_access_grants%rowtype;
  v_grant public.premium_access_grants%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_starts_at timestamptz;
begin
  if p_user_id is null or p_session_id is null or pg_catalog.btrim(p_session_id) = '' then
    raise exception 'INVALID_STRIPE_GRANT_INPUT';
  end if;

  if not (
    (p_plan_code = 'premium_24h' and p_duration_hours = 24)
    or (p_plan_code = 'premium_7d' and p_duration_hours = 168)
    or (p_plan_code = 'premium_30d' and p_duration_hours = 720)
  ) then
    raise exception 'INVALID_STRIPE_PREMIUM_PLAN';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stripe-session:' || p_session_id, 0)
  );

  select grant_row.*
  into v_existing
  from public.premium_access_grants as grant_row
  where grant_row.stripe_checkout_session_id = p_session_id
  limit 1;

  if v_existing.id is not null then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'alreadyApplied', true,
      'grantId', v_existing.id,
      'startsAt', v_existing.starts_at,
      'endsAt', v_existing.ends_at
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stripe-premium-user:' || p_user_id::text, 0)
  );

  select pg_catalog.greatest(v_now, pg_catalog.coalesce(pg_catalog.max(grant_row.ends_at), v_now))
  into v_starts_at
  from public.premium_access_grants as grant_row
  where grant_row.user_id = p_user_id
    and grant_row.ends_at > v_now;

  insert into public.premium_access_grants (
    user_id,
    source,
    product_code,
    starts_at,
    ends_at,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    metadata
  )
  values (
    p_user_id,
    'stripe',
    p_plan_code,
    v_starts_at,
    v_starts_at + pg_catalog.make_interval(hours => p_duration_hours),
    p_session_id,
    p_payment_intent_id,
    pg_catalog.coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_grant;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'alreadyApplied', false,
    'grantId', v_grant.id,
    'startsAt', v_grant.starts_at,
    'endsAt', v_grant.ends_at
  );
end;
$$;

revoke execute on function public.apply_stripe_premium_grant(
  uuid, text, integer, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_stripe_premium_grant(
  uuid, text, integer, text, text, jsonb
) to service_role;
