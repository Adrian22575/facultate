update public.editorial_automation_settings
set model = 'gpt-5.4'
where model = 'gpt-5.6';

alter table public.editorial_automation_settings
  alter column model set default 'gpt-5.4';

alter table public.editorial_automation_settings
  drop constraint if exists editorial_automation_settings_model_check;

alter table public.editorial_automation_settings
  add constraint editorial_automation_settings_model_check
  check (model in ('gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5', 'gpt-5-mini'));
