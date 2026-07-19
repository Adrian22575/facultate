alter table public.linkedin_automation_settings
  add column if not exists default_audience text not null default 'professionals',
  add column if not exists default_cta text not null default 'auto',
  add column if not exists default_narrative text not null default 'neutral_editorial',
  add column if not exists default_length text not null default 'auto',
  add column if not exists default_link_placement text not null default 'end';

alter table public.linkedin_editorial_posts
  add column if not exists audience_key text not null default 'professionals',
  add column if not exists custom_audience text,
  add column if not exists cta_key text not null default 'auto',
  add column if not exists narrative_key text not null default 'neutral_editorial',
  add column if not exists length_key text not null default 'auto',
  add column if not exists link_placement_key text not null default 'end',
  add column if not exists prompt_version text not null default 'linkedin-post-generator-v2',
  add column if not exists quality_score numeric(4,2),
  add column if not exists generation_warnings jsonb not null default '[]'::jsonb,
  add column if not exists feedback text,
  add column if not exists feedback_at timestamptz,
  add column if not exists linkedin_comment_id text,
  add column if not exists link_comment_status text not null default 'not_required',
  add column if not exists link_comment_error text;

alter table public.linkedin_automation_settings
  drop constraint if exists linkedin_automation_settings_default_template_check,
  drop constraint if exists linkedin_automation_settings_default_objective_check,
  drop constraint if exists linkedin_automation_settings_default_voice_check;

alter table public.linkedin_editorial_posts
  drop constraint if exists linkedin_editorial_posts_template_key_check,
  drop constraint if exists linkedin_editorial_posts_goal_key_check,
  drop constraint if exists linkedin_editorial_posts_voice_key_check;

update public.linkedin_automation_settings
set
  default_template = case default_template
    when 'point_of_view' then 'opinion'
    when 'practical_checklist' then 'practical_list'
    when 'data_explained' then 'educational'
    when 'clear_observation' then 'lesson'
    else 'analysis'
  end,
  default_objective = case default_objective
    when 'conversation' then 'comments'
    when 'traffic' then 'traffic'
    else 'authority'
  end,
  default_voice = case default_voice
    when 'teacher_practitioner' then 'educational_simple'
    when 'analytical' then 'analytical'
    when 'conversational' then 'conversational'
    else 'direct_lucid'
  end;

update public.linkedin_editorial_posts
set
  template_key = case template_key
    when 'point_of_view' then 'opinion'
    when 'practical_checklist' then 'practical_list'
    when 'data_explained' then 'educational'
    when 'clear_observation' then 'lesson'
    else 'analysis'
  end,
  goal_key = case goal_key
    when 'conversation' then 'comments'
    when 'traffic' then 'traffic'
    else 'authority'
  end,
  voice_key = case voice_key
    when 'teacher_practitioner' then 'educational_simple'
    when 'analytical' then 'analytical'
    when 'conversational' then 'conversational'
    else 'direct_lucid'
  end,
  prompt_version = coalesce(nullif(prompt_version, ''), 'linkedin-post-generator-v2');

alter table public.linkedin_automation_settings
  alter column default_template set default 'lesson',
  alter column default_objective set default 'authority',
  alter column default_voice set default 'professional_human',
  add constraint linkedin_automation_settings_default_template_check check (default_template in ('opinion', 'lesson', 'story', 'case_study', 'analysis', 'educational', 'practical_list', 'framework', 'debate', 'short_post', 'long_post')),
  add constraint linkedin_automation_settings_default_objective_check check (default_objective in ('authority', 'education', 'comments', 'traffic', 'leads', 'promotion', 'opinion', 'lesson', 'achievement', 'personal_brand')),
  add constraint linkedin_automation_settings_default_voice_check check (default_voice in ('direct_lucid', 'professional_human', 'provocative_credible', 'educational_simple', 'personal_reflective', 'analytical', 'conversational', 'authoritative', 'optimistic_grounded', 'constructive_critical')),
  add constraint linkedin_automation_settings_default_audience_check check (default_audience in ('professionals', 'managers', 'entrepreneurs', 'ai_specialists', 'educators', 'leaders', 'hr', 'digitalization', 'general', 'custom')),
  add constraint linkedin_automation_settings_default_cta_check check (default_cta in ('auto', 'comment', 'click', 'save', 'share', 'message', 'test_product', 'none')),
  add constraint linkedin_automation_settings_default_narrative_check check (default_narrative in ('first_person', 'company', 'neutral_editorial', 'expert', 'founder', 'educator')),
  add constraint linkedin_automation_settings_default_length_check check (default_length in ('auto', 'short', 'medium', 'long')),
  add constraint linkedin_automation_settings_default_link_placement_check check (default_link_placement in ('natural', 'end', 'first_comment', 'none'));

alter table public.linkedin_editorial_posts
  alter column template_key set default 'lesson',
  alter column goal_key set default 'authority',
  alter column voice_key set default 'professional_human',
  add constraint linkedin_editorial_posts_template_key_check check (template_key in ('opinion', 'lesson', 'story', 'case_study', 'analysis', 'educational', 'practical_list', 'framework', 'debate', 'short_post', 'long_post')),
  add constraint linkedin_editorial_posts_goal_key_check check (goal_key in ('authority', 'education', 'comments', 'traffic', 'leads', 'promotion', 'opinion', 'lesson', 'achievement', 'personal_brand')),
  add constraint linkedin_editorial_posts_voice_key_check check (voice_key in ('direct_lucid', 'professional_human', 'provocative_credible', 'educational_simple', 'personal_reflective', 'analytical', 'conversational', 'authoritative', 'optimistic_grounded', 'constructive_critical')),
  add constraint linkedin_editorial_posts_audience_key_check check (audience_key in ('professionals', 'managers', 'entrepreneurs', 'ai_specialists', 'educators', 'leaders', 'hr', 'digitalization', 'general', 'custom')),
  add constraint linkedin_editorial_posts_custom_audience_check check (custom_audience is null or char_length(custom_audience) between 2 and 180),
  add constraint linkedin_editorial_posts_cta_key_check check (cta_key in ('auto', 'comment', 'click', 'save', 'share', 'message', 'test_product', 'none')),
  add constraint linkedin_editorial_posts_narrative_key_check check (narrative_key in ('first_person', 'company', 'neutral_editorial', 'expert', 'founder', 'educator')),
  add constraint linkedin_editorial_posts_length_key_check check (length_key in ('auto', 'short', 'medium', 'long')),
  add constraint linkedin_editorial_posts_link_placement_key_check check (link_placement_key in ('natural', 'end', 'first_comment', 'none')),
  add constraint linkedin_editorial_posts_prompt_version_check check (char_length(prompt_version) between 3 and 120),
  add constraint linkedin_editorial_posts_quality_score_check check (quality_score is null or quality_score between 0 and 10),
  add constraint linkedin_editorial_posts_generation_warnings_check check (jsonb_typeof(generation_warnings) = 'array'),
  add constraint linkedin_editorial_posts_feedback_check check (feedback is null or feedback in ('up', 'down')),
  add constraint linkedin_editorial_posts_link_comment_status_check check (link_comment_status in ('not_required', 'pending', 'published', 'failed', 'unknown'));

comment on column public.linkedin_editorial_posts.generated_payload is
  'Analiza, unghiurile, hook-urile, critica, varianta finală și istoricul refinărilor pentru generatorul LinkedIn versionat.';
comment on column public.linkedin_editorial_posts.prompt_version is
  'Versiunea arhitecturii editoriale folosite pentru generare și comparații ulterioare.';
comment on column public.linkedin_editorial_posts.feedback is
  'Feedback editorial explicit pentru personalizare viitoare: up sau down.';
