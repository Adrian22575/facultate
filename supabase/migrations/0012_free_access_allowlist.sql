create table if not exists public.free_access_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  grant_kind text not null default 'premium' check (grant_kind in ('premium')),
  is_active boolean not null default true,
  notes text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint free_access_allowlist_email_lowercase check (email = lower(email))
);

create index if not exists free_access_allowlist_active_idx
  on public.free_access_allowlist (is_active, created_at desc);

drop trigger if exists free_access_allowlist_set_updated_at on public.free_access_allowlist;
create trigger free_access_allowlist_set_updated_at
  before update on public.free_access_allowlist
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.free_access_allowlist enable row level security;
