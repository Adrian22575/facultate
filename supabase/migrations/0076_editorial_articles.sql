create table if not exists public.editorial_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 20 and 180),
  subtitle text not null default '' check (char_length(subtitle) <= 320),
  summary text not null check (char_length(summary) between 120 and 1400),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  primary_topic text not null check (char_length(primary_topic) between 3 and 120),
  categories text[] not null default '{}',
  key_takeaways jsonb not null default '[]'::jsonb check (jsonb_typeof(key_takeaways) = 'array' and jsonb_array_length(key_takeaways) between 1 and 5),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) between 3 and 5),
  student_implications jsonb not null default '[]'::jsonb check (jsonb_typeof(student_implications) = 'array' and jsonb_array_length(student_implications) between 1 and 6),
  weekly_term jsonb not null default '{}'::jsonb check (jsonb_typeof(weekly_term) = 'object'),
  conclusion text not null check (char_length(conclusion) between 60 and 1800),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) between 5 and 12),
  internal_links jsonb not null default '[]'::jsonb check (jsonb_typeof(internal_links) = 'array'),
  seo_title text not null check (char_length(seo_title) between 20 and 70),
  meta_description text not null check (char_length(meta_description) between 70 and 180),
  social_description text not null check (char_length(social_description) between 70 and 220),
  image_prompt text not null default '',
  reading_minutes smallint not null default 5 check (reading_minutes between 1 and 30),
  word_count integer not null default 0 check (word_count >= 0),
  content_hash text not null unique,
  source_url_hashes text[] not null default '{}',
  quality_score smallint not null default 0 check (quality_score between 0 and 100),
  fact_check_status text not null default 'pending' check (fact_check_status in ('pending', 'passed', 'failed', 'needs_review')),
  fact_check_report jsonb not null default '{}'::jsonb check (jsonb_typeof(fact_check_report) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn', 'rejected')),
  generation_model text,
  correction_note text,
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.editorial_generation_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique check (char_length(run_key) between 8 and 160),
  week_start date not null,
  week_end date not null check (week_end >= week_start),
  trigger_source text not null check (trigger_source in ('cron', 'admin', 'test')),
  status text not null default 'started' check (status in ('started', 'researching', 'validated_research', 'drafted', 'fact_checked', 'published', 'draft', 'rejected', 'failed', 'skipped')),
  model text not null,
  article_id uuid references public.editorial_articles(id) on delete set null,
  candidate_count smallint not null default 0,
  source_count smallint not null default 0,
  topic_count smallint not null default 0,
  quality_score smallint check (quality_score between 0 and 100),
  research_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(research_snapshot) = 'object'),
  validation_report jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_report) = 'object'),
  rejection_reason text,
  error_message text,
  notification_sent boolean not null default false,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists editorial_articles_public_listing_idx on public.editorial_articles (status, published_at desc);
create index if not exists editorial_articles_period_idx on public.editorial_articles (period_end desc);
create index if not exists editorial_articles_categories_idx on public.editorial_articles using gin (categories);
create index if not exists editorial_generation_runs_started_idx on public.editorial_generation_runs (started_at desc);
create unique index if not exists editorial_generation_runs_weekly_cron_idx on public.editorial_generation_runs (week_start)
  where trigger_source = 'cron';

drop trigger if exists editorial_articles_set_updated_at on public.editorial_articles;
create trigger editorial_articles_set_updated_at before update on public.editorial_articles
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists editorial_generation_runs_set_updated_at on public.editorial_generation_runs;
create trigger editorial_generation_runs_set_updated_at before update on public.editorial_generation_runs
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.editorial_articles enable row level security;
alter table public.editorial_generation_runs enable row level security;

revoke all on table public.editorial_articles from anon, authenticated;
revoke all on table public.editorial_generation_runs from anon, authenticated;
grant select on table public.editorial_articles to anon, authenticated;

create policy "editorial_articles_public_read" on public.editorial_articles for select to anon, authenticated
  using (status = 'published');
