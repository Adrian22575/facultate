alter table public.linkedin_automation_settings
  add column if not exists default_custom_audience text;

alter table public.linkedin_automation_settings
  add constraint linkedin_automation_settings_default_custom_audience_check
  check (default_custom_audience is null or char_length(default_custom_audience) between 2 and 180);

comment on column public.linkedin_automation_settings.default_custom_audience is
  'Audiența exactă folosită când valoarea implicită default_audience este custom.';
