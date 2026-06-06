create table if not exists public.admin_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create index if not exists admin_notification_events_created_at_idx
  on public.admin_notification_events (created_at desc);

create index if not exists admin_notification_events_event_type_idx
  on public.admin_notification_events (event_type, created_at desc);

alter table public.admin_notification_events enable row level security;
