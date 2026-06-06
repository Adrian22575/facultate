create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  last_error text,
  processed_at timestamptz
);

create unique index if not exists ai_credit_ledger_unique_stripe_session_reason_idx
  on public.ai_credit_ledger (stripe_checkout_session_id, reason)
  where source = 'stripe' and stripe_checkout_session_id is not null;

create index if not exists stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events (processed_at desc);

drop trigger if exists stripe_customers_set_updated_at on public.stripe_customers;
create trigger stripe_customers_set_updated_at
  before update on public.stripe_customers
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.stripe_customers enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy "stripe_customers_select_own"
  on public.stripe_customers
  for select
  to authenticated
  using (auth.uid() = user_id);
