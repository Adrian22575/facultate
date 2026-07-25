alter table public.editorial_automation_settings
  add column if not exists weekly_day smallint;

update public.editorial_automation_settings
set weekly_day = 1
where frequency_days = 7
  and weekly_day is null;

alter table public.editorial_automation_settings
  drop constraint if exists editorial_automation_settings_weekly_day_check;

alter table public.editorial_automation_settings
  add constraint editorial_automation_settings_weekly_day_check
  check (
    (frequency_days = 7 and weekly_day is not null and weekly_day between 1 and 7)
    or (frequency_days <> 7 and weekly_day is null)
  );

comment on column public.editorial_automation_settings.weekly_day is
  'Ziua ISO a săptămânii pentru frecvența săptămânală: 1=Luni, 7=Duminică.';
