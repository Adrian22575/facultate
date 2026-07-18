create table if not exists public.editorial_automation_settings (
  workflow text primary key check (workflow in ('dictionary', 'editorial')),
  enabled boolean not null default true,
  frequency_days smallint not null default 1 check (frequency_days between 1 and 30),
  model text not null default 'gpt-5.6' check (model in ('gpt-5.6', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5', 'gpt-5-mini')),
  notify_telegram boolean not null default true,
  last_scheduled_for date,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.editorial_automation_settings (workflow, enabled, frequency_days, model, notify_telegram)
values
  ('dictionary', true, 1, 'gpt-5.6', true),
  ('editorial', true, 7, 'gpt-5.6', true)
on conflict (workflow) do nothing;

alter table public.editorial_generation_runs
  add column if not exists run_date date;

update public.editorial_generation_runs
set run_date = week_start
where run_date is null;

alter table public.editorial_generation_runs
  alter column run_date set not null;

drop index if exists public.editorial_generation_runs_weekly_cron_idx;
create unique index if not exists editorial_generation_runs_daily_cron_idx
  on public.editorial_generation_runs (run_date)
  where trigger_source = 'cron';

drop trigger if exists editorial_automation_settings_set_updated_at on public.editorial_automation_settings;
create trigger editorial_automation_settings_set_updated_at
  before update on public.editorial_automation_settings
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.editorial_automation_settings enable row level security;
revoke all on table public.editorial_automation_settings from anon, authenticated;
