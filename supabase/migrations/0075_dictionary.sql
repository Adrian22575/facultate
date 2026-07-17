create table if not exists public.dictionary_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique check (char_length(name) between 3 and 100),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dictionary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique check (char_length(term) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id uuid not null references public.dictionary_categories(id) on delete restrict,
  short_definition text not null check (char_length(short_definition) between 30 and 700),
  simple_explanation text not null check (char_length(simple_explanation) between 80 and 5000),
  analogy text,
  example text not null check (char_length(example) between 40 and 2500),
  why_it_matters text not null check (char_length(why_it_matters) between 40 and 2500),
  how_to_apply jsonb not null default '[]'::jsonb check (jsonb_typeof(how_to_apply) = 'array'),
  synonyms text[] not null default '{}',
  related_term_candidates text[] not null default '{}',
  faqs jsonb not null check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) = 3),
  cta_type text not null check (cta_type in ('practice', 'materials', 'review', 'simulation')),
  seo_title text not null check (char_length(seo_title) between 20 and 70),
  meta_description text not null check (char_length(meta_description) between 70 and 180),
  search_intent text not null default '',
  sources_needed boolean not null default false,
  quality_notes text not null default '',
  quality_score smallint not null default 0 check (quality_score between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn', 'rejected')),
  generated_model text,
  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dictionary_term_relations (
  term_id uuid not null references public.dictionary_terms(id) on delete cascade,
  related_term_id uuid not null references public.dictionary_terms(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (term_id, related_term_id),
  check (term_id <> related_term_id)
);

create table if not exists public.dictionary_generation_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique check (char_length(run_key) between 5 and 120),
  run_date date not null,
  trigger_source text not null check (trigger_source in ('cron', 'admin')),
  status text not null default 'started' check (status in ('started', 'generated', 'validated', 'published', 'skipped', 'failed', 'notification_failed')),
  candidate_term text,
  published_term_id uuid references public.dictionary_terms(id) on delete set null,
  model text,
  attempts smallint not null default 0 check (attempts between 0 and 2),
  quality_score smallint check (quality_score between 0 and 100),
  rejection_reason text,
  error_message text,
  notification_sent boolean not null default false,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists dictionary_categories_sort_order_idx
  on public.dictionary_categories (sort_order, name);
create index if not exists dictionary_terms_public_listing_idx
  on public.dictionary_terms (status, category_id, term);
create index if not exists dictionary_terms_published_at_idx
  on public.dictionary_terms (published_at desc) where status = 'published';
create index if not exists dictionary_terms_updated_at_idx
  on public.dictionary_terms (updated_at desc);
create index if not exists dictionary_term_relations_related_idx
  on public.dictionary_term_relations (related_term_id, term_id);
create index if not exists dictionary_generation_runs_started_at_idx
  on public.dictionary_generation_runs (started_at desc);
create unique index if not exists dictionary_generation_runs_daily_cron_idx
  on public.dictionary_generation_runs (run_date)
  where trigger_source = 'cron';

drop trigger if exists dictionary_categories_set_updated_at on public.dictionary_categories;
create trigger dictionary_categories_set_updated_at
  before update on public.dictionary_categories
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists dictionary_terms_set_updated_at on public.dictionary_terms;
create trigger dictionary_terms_set_updated_at
  before update on public.dictionary_terms
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists dictionary_generation_runs_set_updated_at on public.dictionary_generation_runs;
create trigger dictionary_generation_runs_set_updated_at
  before update on public.dictionary_generation_runs
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.dictionary_categories enable row level security;
alter table public.dictionary_terms enable row level security;
alter table public.dictionary_term_relations enable row level security;
alter table public.dictionary_generation_runs enable row level security;

revoke all on table public.dictionary_categories from anon, authenticated;
revoke all on table public.dictionary_terms from anon, authenticated;
revoke all on table public.dictionary_term_relations from anon, authenticated;
revoke all on table public.dictionary_generation_runs from anon, authenticated;

grant select on table public.dictionary_categories to anon, authenticated;
grant select on table public.dictionary_terms to anon, authenticated;
grant select on table public.dictionary_term_relations to anon, authenticated;

create policy "dictionary_categories_public_read"
  on public.dictionary_categories for select to anon, authenticated using (true);

create policy "dictionary_terms_public_read"
  on public.dictionary_terms for select to anon, authenticated using (status = 'published');

create policy "dictionary_relations_public_read"
  on public.dictionary_term_relations for select to anon, authenticated
  using (
    exists (select 1 from public.dictionary_terms term where term.id = term_id and term.status = 'published')
    and exists (select 1 from public.dictionary_terms related where related.id = related_term_id and related.status = 'published')
  );
