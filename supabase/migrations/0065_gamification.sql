create table if not exists public.gamification_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_points integer not null default 0 check (total_points >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_active_date date,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.gamification_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (pg_catalog.length(pg_catalog.btrim(action_type)) between 3 and 80),
  points integer not null check (points > 0 and points <= 1000),
  activity_date date not null,
  reference_type text,
  reference_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint gamification_point_transactions_user_idempotency_unique unique (user_id, idempotency_key)
);

create table if not exists public.gamification_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  action_count integer not null default 0 check (action_count >= 0),
  points_earned integer not null default 0 check (points_earned >= 0),
  first_activity_at timestamptz not null default pg_catalog.now(),
  last_activity_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, activity_date)
);

create table if not exists public.gamification_levels (
  level_key text primary key,
  position integer not null unique check (position > 0),
  title text not null,
  min_points integer not null unique check (min_points >= 0),
  badge text not null,
  unlock_message text not null
);

create table if not exists public.gamification_achievements (
  achievement_key text primary key,
  title text not null,
  description text not null,
  badge text not null,
  requirement_type text not null,
  requirement_value integer not null check (requirement_value > 0),
  bonus_points integer not null default 0 check (bonus_points >= 0 and bonus_points <= 1000),
  sort_order integer not null default 100
);

create table if not exists public.gamification_user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.gamification_achievements(achievement_key) on delete cascade,
  unlocked_at timestamptz not null default pg_catalog.now(),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_key)
);

create index if not exists gamification_profiles_points_idx
  on public.gamification_profiles (total_points desc);

create index if not exists gamification_point_transactions_user_created_idx
  on public.gamification_point_transactions (user_id, created_at desc);

create index if not exists gamification_point_transactions_user_action_idx
  on public.gamification_point_transactions (user_id, action_type, created_at desc);

create index if not exists gamification_daily_activity_user_date_idx
  on public.gamification_daily_activity (user_id, activity_date desc);

create index if not exists gamification_user_achievements_user_unlocked_idx
  on public.gamification_user_achievements (user_id, unlocked_at desc);

alter table public.gamification_profiles enable row level security;
alter table public.gamification_point_transactions enable row level security;
alter table public.gamification_daily_activity enable row level security;
alter table public.gamification_levels enable row level security;
alter table public.gamification_achievements enable row level security;
alter table public.gamification_user_achievements enable row level security;

drop policy if exists "gamification_profiles_select_own" on public.gamification_profiles;
create policy "gamification_profiles_select_own"
  on public.gamification_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "gamification_point_transactions_select_own" on public.gamification_point_transactions;
create policy "gamification_point_transactions_select_own"
  on public.gamification_point_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "gamification_daily_activity_select_own" on public.gamification_daily_activity;
create policy "gamification_daily_activity_select_own"
  on public.gamification_daily_activity
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "gamification_levels_select_authenticated" on public.gamification_levels;
create policy "gamification_levels_select_authenticated"
  on public.gamification_levels
  for select
  to authenticated
  using (true);

drop policy if exists "gamification_achievements_select_authenticated" on public.gamification_achievements;
create policy "gamification_achievements_select_authenticated"
  on public.gamification_achievements
  for select
  to authenticated
  using (true);

drop policy if exists "gamification_user_achievements_select_own" on public.gamification_user_achievements;
create policy "gamification_user_achievements_select_own"
  on public.gamification_user_achievements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.gamification_profiles to authenticated;
grant select on public.gamification_point_transactions to authenticated;
grant select on public.gamification_daily_activity to authenticated;
grant select on public.gamification_levels to authenticated;
grant select on public.gamification_achievements to authenticated;
grant select on public.gamification_user_achievements to authenticated;

insert into public.gamification_levels (level_key, position, title, min_points, badge, unlock_message)
values
  ('incepator', 1, 'Incepator', 0, '1', 'Ai pornit progresul Nota 5+.'),
  ('explorator', 2, 'Explorator', 120, '2', 'Ai prins ritmul primelor sesiuni.'),
  ('student_ambitios', 3, 'Student ambitios', 350, '3', 'Inveti constant si se vede.'),
  ('cunoscator', 4, 'Cunoscator', 800, '4', 'Ai deja o baza solida de raspunsuri.'),
  ('strateg', 5, 'Strateg al invatarii', 1500, '5', 'Folosesti testele si greselile strategic.'),
  ('expert', 6, 'Expert', 2800, '6', 'Ai un ritm avansat de pregatire.'),
  ('maestru_grile', 7, 'Maestru al grilelor', 5000, '7', 'Stapanesti multe runde si simulari.'),
  ('campion_nota5', 8, 'Campion Nota 5+', 9000, '8', 'Ai ajuns la nivelul cel mai greu.')
on conflict (level_key) do update set
  position = excluded.position,
  title = excluded.title,
  min_points = excluded.min_points,
  badge = excluded.badge,
  unlock_message = excluded.unlock_message;

insert into public.gamification_achievements (
  achievement_key,
  title,
  description,
  badge,
  requirement_type,
  requirement_value,
  bonus_points,
  sort_order
)
values
  ('first_test', 'Primul test finalizat', 'Finalizeaza primul test sau prima simulare.', 'T1', 'tests_completed', 1, 30, 10),
  ('questions_100', '100 de intrebari', 'Raspunde la 100 de intrebari.', '100', 'questions_answered', 100, 50, 20),
  ('questions_500', '500 de intrebari', 'Raspunde la 500 de intrebari.', '500', 'questions_answered', 500, 120, 30),
  ('streak_7', '7 zile la rand', 'Invata 7 zile consecutive.', '7Z', 'best_streak', 7, 70, 40),
  ('streak_30', '30 de zile la rand', 'Invata 30 de zile consecutive.', '30Z', 'best_streak', 30, 250, 50),
  ('first_80', 'Peste 80%', 'Obtine primul rezultat de cel putin 80%.', '80%', 'score_at_least', 80, 40, 60),
  ('first_100', 'Runda perfecta', 'Obtine primul rezultat de 100%.', '100%', 'score_at_least', 100, 80, 70),
  ('licenta_10', '10 simulari de licenta', 'Finalizeaza 10 runde de licenta.', 'L10', 'licenta_completed', 10, 150, 80),
  ('correct_100', '100 de raspunsuri corecte', 'Strange 100 de raspunsuri corecte.', 'C100', 'correct_answers', 100, 60, 90),
  ('mistakes_fixed', 'Invata din greseli', 'Finalizeaza o runda dedicata greselilor.', 'G', 'mistakes_completed', 1, 50, 100)
on conflict (achievement_key) do update set
  title = excluded.title,
  description = excluded.description,
  badge = excluded.badge,
  requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value,
  bonus_points = excluded.bonus_points,
  sort_order = excluded.sort_order;

create or replace function public.refresh_gamification_achievements(p_user_id uuid)
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
  v_today date := (pg_catalog.now() at time zone 'Europe/Bucharest')::date;
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
      select count(*)::integer
      into v_metric
      from public.gamification_point_transactions
      where user_id = p_user_id
        and metadata->>'scorePercent' ~ '^[0-9]+$'
        and (metadata->>'scorePercent')::integer >= v_achievement.requirement_value;
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

      if found then
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
            v_today,
            'achievement',
            v_achievement.achievement_key,
            v_bonus_key,
            pg_catalog.jsonb_build_object('achievementKey', v_achievement.achievement_key)
          )
          on conflict (user_id, idempotency_key) do nothing;

          if found then
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
              v_today,
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
    set best_streak = pg_catalog.greatest(best_streak, current_streak),
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

revoke execute on function public.refresh_gamification_achievements(uuid) from public, anon, authenticated;
grant execute on function public.refresh_gamification_achievements(uuid) to service_role;

revoke execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.award_gamification_points(
  uuid, text, integer, text, text, text, jsonb, timestamptz
) to service_role;
