create table if not exists public.linkedin_connections (
  id uuid primary key default gen_random_uuid(),
  member_subject text not null unique check (char_length(member_subject) between 2 and 180),
  member_urn text not null unique check (member_urn ~ '^urn:li:person:[A-Za-z0-9_-]+$'),
  display_name text check (display_name is null or char_length(display_name) <= 180),
  profile_picture_url text check (profile_picture_url is null or char_length(profile_picture_url) <= 1200),
  access_token_encrypted text not null check (char_length(access_token_encrypted) between 40 and 12000),
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'connection_expired', 'disconnected', 'error')),
  last_error text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default timezone('utc', now()),
  disconnected_at timestamptz,
  last_published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.linkedin_automation_settings (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'approval_required' check (mode in ('disabled', 'draft_only', 'auto_publish', 'approval_required')),
  notify_telegram boolean not null default true,
  include_article_image boolean not null default false,
  fallback_to_text boolean not null default true,
  model text not null default 'gpt-5.6' check (char_length(model) between 2 and 80),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.linkedin_automation_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.linkedin_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique check (char_length(state_hash) = 64),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  return_path text not null default '/admin?admin_tab=editorial' check (return_path ~ '^/admin'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.linkedin_editorial_posts (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.editorial_articles(id) on delete cascade,
  connection_id uuid not null references public.linkedin_connections(id) on delete restrict,
  status text not null default 'not_generated' check (status in ('not_generated', 'draft', 'pending_approval', 'approved', 'publishing', 'published', 'failed', 'connection_expired', 'rejected')),
  generated_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(generated_payload) = 'object'),
  generated_text text,
  edited_text text,
  character_count integer not null default 0 check (character_count between 0 and 3000),
  claims jsonb not null default '[]'::jsonb check (jsonb_typeof(claims) = 'array'),
  model text,
  generation_started_at timestamptz,
  generated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  linkedin_post_urn text,
  linkedin_post_url text,
  publish_request_key text not null default gen_random_uuid()::text,
  publish_started_at timestamptz,
  last_error text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  notification_sent boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (article_id, connection_id),
  unique (publish_request_key),
  unique (linkedin_post_urn)
);

create index if not exists linkedin_connections_status_idx on public.linkedin_connections (status, token_expires_at);
create index if not exists linkedin_oauth_states_expiry_idx on public.linkedin_oauth_states (expires_at) where used_at is null;
create index if not exists linkedin_editorial_posts_status_idx on public.linkedin_editorial_posts (status, updated_at desc);
create index if not exists linkedin_editorial_posts_article_idx on public.linkedin_editorial_posts (article_id, created_at desc);

drop trigger if exists linkedin_connections_set_updated_at on public.linkedin_connections;
create trigger linkedin_connections_set_updated_at before update on public.linkedin_connections
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists linkedin_automation_settings_set_updated_at on public.linkedin_automation_settings;
create trigger linkedin_automation_settings_set_updated_at before update on public.linkedin_automation_settings
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists linkedin_editorial_posts_set_updated_at on public.linkedin_editorial_posts;
create trigger linkedin_editorial_posts_set_updated_at before update on public.linkedin_editorial_posts
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.linkedin_connections enable row level security;
alter table public.linkedin_automation_settings enable row level security;
alter table public.linkedin_oauth_states enable row level security;
alter table public.linkedin_editorial_posts enable row level security;

revoke all on table public.linkedin_connections from public, anon, authenticated;
revoke all on table public.linkedin_automation_settings from public, anon, authenticated;
revoke all on table public.linkedin_oauth_states from public, anon, authenticated;
revoke all on table public.linkedin_editorial_posts from public, anon, authenticated;

grant all on table public.linkedin_connections to service_role;
grant all on table public.linkedin_automation_settings to service_role;
grant all on table public.linkedin_oauth_states to service_role;
grant all on table public.linkedin_editorial_posts to service_role;

comment on column public.linkedin_connections.access_token_encrypted is
  'Access token criptat pe server cu AES-256-GCM; nu conține token în clar.';
comment on table public.linkedin_editorial_posts is
  'Un singur obiect de distribuire LinkedIn per articol și profil conectat.';
