create table if not exists public.admin_notification_views (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  viewed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (admin_user_id, scope)
);

create index if not exists admin_notification_views_admin_user_id_idx
  on public.admin_notification_views (admin_user_id);

create index if not exists admin_notification_views_scope_idx
  on public.admin_notification_views (scope);

alter table public.admin_notification_views enable row level security;
