alter table public.linkedin_automation_settings
  add column if not exists default_objective text not null default 'credibility',
  add column if not exists default_voice text not null default 'direct';

alter table public.linkedin_editorial_posts
  add column if not exists goal_key text not null default 'credibility',
  add column if not exists voice_key text not null default 'direct';

alter table public.linkedin_automation_settings
  drop constraint if exists linkedin_automation_settings_default_template_check;

alter table public.linkedin_editorial_posts
  drop constraint if exists linkedin_editorial_posts_template_key_check;

update public.linkedin_automation_settings
set default_template = case default_template
  when 'three_takeaways' then 'practical_checklist'
  when 'professional_angle' then 'point_of_view'
  when 'conversation_starter' then 'point_of_view'
  else 'what_matters_now'
end;

update public.linkedin_editorial_posts
set template_key = case template_key
  when 'three_takeaways' then 'practical_checklist'
  when 'professional_angle' then 'point_of_view'
  when 'conversation_starter' then 'point_of_view'
  else 'what_matters_now'
end;

alter table public.linkedin_automation_settings
  add constraint linkedin_automation_settings_default_template_check
    check (default_template in ('what_matters_now', 'point_of_view', 'practical_checklist', 'clear_observation', 'data_explained')),
  add constraint linkedin_automation_settings_default_objective_check
    check (default_objective in ('conversation', 'traffic', 'credibility')),
  add constraint linkedin_automation_settings_default_voice_check
    check (default_voice in ('direct', 'teacher_practitioner', 'analytical', 'conversational')),
  alter column default_template set default 'what_matters_now';

alter table public.linkedin_editorial_posts
  add constraint linkedin_editorial_posts_template_key_check
    check (template_key in ('what_matters_now', 'point_of_view', 'practical_checklist', 'clear_observation', 'data_explained')),
  add constraint linkedin_editorial_posts_goal_key_check
    check (goal_key in ('conversation', 'traffic', 'credibility')),
  add constraint linkedin_editorial_posts_voice_key_check
    check (voice_key in ('direct', 'teacher_practitioner', 'analytical', 'conversational'));

comment on column public.linkedin_automation_settings.default_objective is
  'Obiectivul implicit al unei postări LinkedIn: conversație, trafic sau credibilitate.';

comment on column public.linkedin_automation_settings.default_voice is
  'Vocea implicită a unei postări LinkedIn.';

comment on column public.linkedin_editorial_posts.goal_key is
  'Obiectivul ales pentru această variantă a postării LinkedIn.';

comment on column public.linkedin_editorial_posts.voice_key is
  'Vocea aleasă pentru această variantă a postării LinkedIn.';
