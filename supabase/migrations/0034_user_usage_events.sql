create table if not exists public.user_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null check (char_length(event_name) between 2 and 80),
  feature text,
  route_path text,
  route_query text,
  referrer_path text,
  device_type text not null default 'unknown' check (device_type in ('desktop', 'tablet', 'mobile', 'unknown')),
  viewport_width integer,
  viewport_height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_usage_events enable row level security;

revoke all on table public.user_usage_events from anon;
revoke all on table public.user_usage_events from authenticated;

create index if not exists user_usage_events_created_at_idx
  on public.user_usage_events (created_at desc);

create index if not exists user_usage_events_user_created_at_idx
  on public.user_usage_events (user_id, created_at desc);

create index if not exists user_usage_events_session_created_at_idx
  on public.user_usage_events (session_id, created_at desc);

create index if not exists user_usage_events_event_created_at_idx
  on public.user_usage_events (event_name, created_at desc);

create index if not exists user_usage_events_feature_created_at_idx
  on public.user_usage_events (feature, created_at desc);

create index if not exists user_usage_events_route_created_at_idx
  on public.user_usage_events (route_path, created_at desc);
