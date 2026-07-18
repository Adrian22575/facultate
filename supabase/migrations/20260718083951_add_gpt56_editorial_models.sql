alter table public.editorial_automation_settings
  drop constraint if exists editorial_automation_settings_model_check;

alter table public.editorial_automation_settings
  add constraint editorial_automation_settings_model_check
  check (model in ('gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4', 'gpt-5.4-mini'));
