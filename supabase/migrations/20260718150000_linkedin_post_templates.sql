alter table public.linkedin_automation_settings
  add column if not exists default_template text not null default 'practical_brief';

alter table public.linkedin_automation_settings
  add constraint linkedin_automation_settings_default_template_check
  check (default_template in ('practical_brief', 'what_changes', 'three_takeaways', 'professional_angle', 'conversation_starter'));

alter table public.linkedin_editorial_posts
  add column if not exists template_key text not null default 'practical_brief';

alter table public.linkedin_editorial_posts
  add constraint linkedin_editorial_posts_template_key_check
  check (template_key in ('practical_brief', 'what_changes', 'three_takeaways', 'professional_angle', 'conversation_starter'));

comment on column public.linkedin_automation_settings.default_template is
  'Formatul implicit folosit pentru pregătirea automată a postărilor LinkedIn.';

comment on column public.linkedin_editorial_posts.template_key is
  'Formatul selectat pentru această postare LinkedIn.';
