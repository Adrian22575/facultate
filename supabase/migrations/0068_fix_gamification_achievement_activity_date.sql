create or replace function public.refresh_gamification_achievements(
  p_user_id uuid,
  p_activity_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.gamification_profiles%rowtype;
  v_achievement public.gamification_achievements%rowtype;
  v_metric integer := 0;
  v_unlocked jsonb := '[]'::jsonb;
  v_bonus_key text;
  v_activity_date date := coalesce(p_activity_date, (pg_catalog.now() at time zone 'Europe/Bucharest')::date);
  v_inserted_count integer := 0;
  v_bonus_inserted_count integer := 0;
begin
  select *
  into v_profile
  from public.gamification_profiles
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.gamification_profiles (user_id)
    values (p_user_id)
    returning * into v_profile;
  end if;

  for v_achievement in
    select *
    from public.gamification_achievements
    where not exists (
      select 1
      from public.gamification_user_achievements unlocked
      where unlocked.user_id = p_user_id
        and unlocked.achievement_key = gamification_achievements.achievement_key
    )
    order by sort_order, achievement_key
  loop
    v_metric := 0;
    v_inserted_count := 0;
    v_bonus_inserted_count := 0;

    if v_achievement.requirement_type = 'tests_completed' then
      select count(*)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id
        and action_type in (
          'subject_test_completed',
          'learning_quiz_completed',
          'learning_mistakes_completed',
          'licenta_simulation_completed',
          'licenta_mistakes_completed'
        );
    elsif v_achievement.requirement_type = 'questions_answered' then
      select coalesce(sum(
        case
          when metadata->>'questionCount' ~ '^[0-9]+$'
            then (metadata->>'questionCount')::integer
          else 0
        end
      ), 0)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id;
    elsif v_achievement.requirement_type = 'best_streak' then
      v_metric := coalesce(v_profile.best_streak, 0);
    elsif v_achievement.requirement_type = 'score_at_least' then
      select coalesce(max(
        case
          when metadata->>'scorePercent' ~ '^[0-9]+$'
            then (metadata->>'scorePercent')::integer
          else 0
        end
      ), 0)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id;
    elsif v_achievement.requirement_type = 'licenta_completed' then
      select count(*)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id
        and action_type = 'licenta_simulation_completed';
    elsif v_achievement.requirement_type = 'correct_answers' then
      select coalesce(sum(
        case
          when metadata->>'correctCount' ~ '^[0-9]+$'
            then (metadata->>'correctCount')::integer
          else 0
        end
      ), 0)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id;
    elsif v_achievement.requirement_type = 'mistakes_completed' then
      select count(*)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id
        and action_type in ('learning_mistakes_completed', 'licenta_mistakes_completed');
    end if;

    if v_metric >= v_achievement.requirement_value then
      insert into public.gamification_user_achievements (
        user_id,
        achievement_key,
        points_awarded,
        metadata
      )
      values (
        p_user_id,
        v_achievement.achievement_key,
        v_achievement.bonus_points,
        pg_catalog.jsonb_build_object('metricValue', v_metric)
      )
      on conflict do nothing;

      get diagnostics v_inserted_count = row_count;

      if v_inserted_count > 0 then
        v_unlocked := v_unlocked || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'key', v_achievement.achievement_key,
            'title', v_achievement.title,
            'bonusPoints', v_achievement.bonus_points
          )
        );

        if v_achievement.bonus_points > 0 then
          v_bonus_key := 'achievement:' || v_achievement.achievement_key;

          insert into public.gamification_point_transactions (
            user_id,
            action_type,
            points,
            activity_date,
            reference_type,
            reference_id,
            idempotency_key,
            metadata
          )
          values (
            p_user_id,
            'achievement_unlocked',
            v_achievement.bonus_points,
            v_activity_date,
            'achievement',
            v_achievement.achievement_key,
            v_bonus_key,
            pg_catalog.jsonb_build_object('achievementKey', v_achievement.achievement_key)
          )
          on conflict (user_id, idempotency_key) do nothing;

          get diagnostics v_bonus_inserted_count = row_count;

          if v_bonus_inserted_count > 0 then
            update public.gamification_profiles
            set total_points = total_points + v_achievement.bonus_points,
                updated_at = pg_catalog.now()
            where user_id = p_user_id;

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
              0,
              v_achievement.bonus_points,
              pg_catalog.now(),
              pg_catalog.now()
            )
            on conflict (user_id, activity_date)
            do update set
              points_earned = public.gamification_daily_activity.points_earned + excluded.points_earned,
              last_activity_at = excluded.last_activity_at;
          end if;
        end if;
      end if;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('unlocked', v_unlocked);
end;
$$;

create or replace function public.refresh_gamification_achievements(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return public.refresh_gamification_achievements(
    p_user_id,
    (pg_catalog.now() at time zone 'Europe/Bucharest')::date
  );
end;
$$;

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
      and action_count > 0
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

    v_achievements := public.refresh_gamification_achievements(p_user_id, v_activity_date);
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

revoke execute on function public.refresh_gamification_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_gamification_achievements(uuid, date) from public, anon, authenticated;
revoke execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;

grant execute on function public.refresh_gamification_achievements(uuid) to service_role;
grant execute on function public.refresh_gamification_achievements(uuid, date) to service_role;
grant execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) to service_role;
