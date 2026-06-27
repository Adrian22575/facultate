create or replace function public.award_gamification_points(
  p_user_id uuid,
  p_action_type text,
  p_points integer,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_activity_date date := (p_occurred_at at time zone 'Europe/Bucharest')::date;
  v_had_day boolean := false;
  v_created boolean := false;
  v_row_count integer := 0;
  v_profile public.gamification_profiles%rowtype;
  v_achievements jsonb := '{"unlocked":[]}'::jsonb;
begin
  if p_user_id is null
    or p_points is null
    or p_points < 1
    or p_points > 1000
    or p_action_type is null
    or pg_catalog.length(pg_catalog.btrim(p_action_type)) < 3
    or p_idempotency_key is null
    or pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) < 8 then
    raise exception 'INVALID_GAMIFICATION_AWARD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('gamification:' || p_user_id::text, 0)
  );

  insert into public.gamification_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select exists (
    select 1
    from public.gamification_daily_activity
    where user_id = p_user_id
      and activity_date = v_activity_date
  )
  into v_had_day;

  insert into public.gamification_point_transactions (
    user_id,
    action_type,
    points,
    activity_date,
    reference_type,
    reference_id,
    idempotency_key,
    metadata,
    created_at
  )
  values (
    p_user_id,
    p_action_type,
    p_points,
    v_activity_date,
    p_reference_type,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    p_occurred_at
  )
  on conflict (user_id, idempotency_key) do nothing;

  get diagnostics v_row_count = row_count;
  v_created := v_row_count > 0;

  if v_created then
    insert into public.gamification_daily_activity (
      user_id,
      activity_date,
      action_count,
      points_earned,
      first_activity_at,
      last_activity_at
    )
    values (
      p_user_id,
      v_activity_date,
      1,
      p_points,
      p_occurred_at,
      p_occurred_at
    )
    on conflict (user_id, activity_date)
    do update set
      action_count = public.gamification_daily_activity.action_count + 1,
      points_earned = public.gamification_daily_activity.points_earned + excluded.points_earned,
      last_activity_at = excluded.last_activity_at;

    update public.gamification_profiles
    set total_points = total_points + p_points,
        current_streak = case
          when v_had_day then current_streak
          when last_active_date = v_activity_date - 1 then current_streak + 1
          when last_active_date = v_activity_date then current_streak
          else 1
        end,
        last_active_date = case
          when last_active_date is null or last_active_date <= v_activity_date
            then v_activity_date
          else last_active_date
        end,
        updated_at = pg_catalog.now()
    where user_id = p_user_id;

    update public.gamification_profiles
    set best_streak = greatest(best_streak, current_streak),
        updated_at = pg_catalog.now()
    where user_id = p_user_id;

    v_achievements := public.refresh_gamification_achievements(p_user_id);
  end if;

  select *
  into v_profile
  from public.gamification_profiles
  where user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'created', v_created,
    'pointsAwarded', case when v_created then p_points else 0 end,
    'totalPoints', coalesce(v_profile.total_points, 0),
    'currentStreak', coalesce(v_profile.current_streak, 0),
    'bestStreak', coalesce(v_profile.best_streak, 0),
    'lastActiveDate', v_profile.last_active_date,
    'activityDate', v_activity_date,
    'unlockedAchievements', coalesce(v_achievements->'unlocked', '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) to service_role;
