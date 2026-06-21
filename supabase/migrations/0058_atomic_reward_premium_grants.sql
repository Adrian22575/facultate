create or replace function public.apply_reward_premium_grant(
  p_user_id uuid,
  p_source text,
  p_plan_code text,
  p_duration_hours integer,
  p_reference_id text,
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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_user_id is null or p_source not in ('welcome', 'referral', 'testimonial') then
    raise exception 'INVALID_REWARD_GRANT_INPUT';
  end if;
  if p_plan_code <> 'premium_24h' or p_duration_hours <> 24 then
    raise exception 'INVALID_REWARD_PREMIUM_PLAN';
  end if;
  if p_source in ('referral', 'testimonial') and coalesce(pg_catalog.btrim(p_reference_id), '') = '' then
    raise exception 'REWARD_REFERENCE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stripe-premium-user:' || p_user_id::text, 0)
  );

  if p_source = 'welcome' then
    select grant_row.* into v_existing
    from public.premium_access_grants as grant_row
    where grant_row.user_id = p_user_id
      and grant_row.source = 'welcome'
      and grant_row.product_code = p_plan_code
    limit 1;
    v_metadata := v_metadata || pg_catalog.jsonb_build_object('welcomeBenefitId', p_reference_id);
  elsif p_source = 'referral' then
    select grant_row.* into v_existing
    from public.premium_access_grants as grant_row
    where grant_row.source = 'referral'
      and grant_row.metadata ->> 'referralId' = p_reference_id
    limit 1;
    v_metadata := v_metadata || pg_catalog.jsonb_build_object('referralId', p_reference_id);
  else
    select grant_row.* into v_existing
    from public.premium_access_grants as grant_row
    where grant_row.source = 'testimonial'
      and grant_row.metadata ->> 'testimonialRewardSubmissionId' = p_reference_id
    limit 1;
    v_metadata := v_metadata || pg_catalog.jsonb_build_object(
      'testimonialRewardSubmissionId', p_reference_id
    );
  end if;

  if v_existing.id is not null then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'alreadyApplied', true,
      'grantId', v_existing.id,
      'startsAt', v_existing.starts_at,
      'endsAt', v_existing.ends_at
    );
  end if;

  select greatest(v_now, coalesce(max(grant_row.ends_at), v_now))
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
    metadata
  )
  values (
    p_user_id,
    p_source,
    p_plan_code,
    v_starts_at,
    v_starts_at + pg_catalog.make_interval(hours => p_duration_hours),
    v_metadata
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

revoke execute on function public.apply_reward_premium_grant(
  uuid, text, text, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_reward_premium_grant(
  uuid, text, text, integer, text, jsonb
) to service_role;
