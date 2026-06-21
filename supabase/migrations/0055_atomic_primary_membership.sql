create unique index if not exists cohorts_community_identity_unique_idx
  on public.cohorts (
    institution_id,
    coalesce(program_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    cohort_type,
    lower(label)
  );

create unique index if not exists memberships_one_active_primary_per_user_idx
  on public.memberships (user_id)
  where is_primary = true and status = 'active';

create or replace function public.save_primary_academic_membership(
  p_user_id uuid,
  p_user_type text,
  p_institution_id uuid,
  p_program_unit_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_institution_type text;
  v_expected_unit_type text;
  v_cohort_type text;
  v_cohort_label text;
  v_cohort_id uuid;
  v_membership_id uuid;
begin
  if p_user_type not in ('student', 'elev') then
    raise exception 'INVALID_USER_TYPE';
  end if;

  v_expected_institution_type := case when p_user_type = 'student' then 'university' else 'school' end;
  v_expected_unit_type := case when p_user_type = 'student' then 'program' else 'profile' end;
  v_cohort_type := case when p_user_type = 'student' then 'student_group' else 'school_class' end;
  v_cohort_label := case
    when p_user_type = 'student' then 'Comunitate generala studenti'
    else 'Comunitate generala elevi'
  end;

  if not exists (
    select 1
    from public.institutions as institution
    where institution.id = p_institution_id
      and institution.institution_type = v_expected_institution_type
  ) then
    raise exception 'INVALID_INSTITUTION';
  end if;

  if p_user_type = 'student' and p_program_unit_id is null then
    raise exception 'PROGRAM_REQUIRED';
  end if;

  if p_program_unit_id is not null and not exists (
    select 1
    from public.academic_units as unit
    where unit.id = p_program_unit_id
      and unit.institution_id = p_institution_id
      and unit.unit_type = v_expected_unit_type
  ) then
    raise exception 'INVALID_PROGRAM_UNIT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_institution_id::text || ':' || coalesce(p_program_unit_id::text, '') || ':' || v_cohort_type || ':' || lower(v_cohort_label),
      0
    )
  );

  select cohort.id
  into v_cohort_id
  from public.cohorts as cohort
  where cohort.institution_id = p_institution_id
    and cohort.program_unit_id is not distinct from p_program_unit_id
    and cohort.cohort_type = v_cohort_type
    and lower(cohort.label) = lower(v_cohort_label)
  order by cohort.created_at asc
  limit 1;

  if v_cohort_id is null then
    insert into public.cohorts (
      institution_id,
      program_unit_id,
      cohort_type,
      label,
      source,
      created_by
    )
    values (
      p_institution_id,
      p_program_unit_id,
      v_cohort_type,
      v_cohort_label,
      'admin',
      p_user_id
    )
    returning id into v_cohort_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':primary-membership', 0)
  );

  update public.memberships
  set is_primary = false
  where user_id = p_user_id
    and is_primary = true;

  insert into public.memberships (
    user_id,
    institution_id,
    program_unit_id,
    cohort_id,
    membership_role,
    status,
    is_primary
  )
  values (
    p_user_id,
    p_institution_id,
    p_program_unit_id,
    v_cohort_id,
    'member',
    'active',
    true
  )
  on conflict (user_id, cohort_id)
  do update
  set institution_id = excluded.institution_id,
      program_unit_id = excluded.program_unit_id,
      membership_role = 'member',
      status = 'active',
      is_primary = true
  returning id into v_membership_id;

  update public.profiles
  set user_type = p_user_type,
      primary_membership_id = v_membership_id,
      onboarding_completed = true,
      onboarding_completed_at = pg_catalog.now()
  where id = p_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return pg_catalog.jsonb_build_object(
    'membershipId', v_membership_id,
    'cohortId', v_cohort_id,
    'institutionId', p_institution_id,
    'programUnitId', p_program_unit_id
  );
end;
$$;

revoke execute on function public.save_primary_academic_membership(
  uuid, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.save_primary_academic_membership(
  uuid, text, uuid, uuid
) to service_role;
