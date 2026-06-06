alter table public.premium_access_grants
  drop constraint if exists premium_access_grants_source_check;

alter table public.premium_access_grants
  add constraint premium_access_grants_source_check
  check (source in ('stripe', 'admin', 'manual', 'welcome'));

alter table public.ai_credit_ledger
  drop constraint if exists ai_credit_ledger_source_check;

alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_source_check
  check (source in ('stripe', 'generation', 'admin', 'manual', 'welcome'));

alter table public.ai_credit_ledger
  drop constraint if exists ai_credit_ledger_reason_check;

alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_reason_check
  check (reason in ('ai_upload_1', 'ai_upload_5', 'generation_consume', 'manual_adjustment', 'welcome_upload_1'));

create table if not exists public.user_welcome_benefits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  benefit_type text not null check (benefit_type in ('premium_24h_claim')),
  status text not null default 'available' check (status in ('available', 'activated')),
  activated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_welcome_benefits_user_benefit_unique unique (user_id, benefit_type),
  constraint user_welcome_benefits_activated_requires_timestamp
    check ((status <> 'activated') or activated_at is not null)
);

create index if not exists user_welcome_benefits_user_status_idx
  on public.user_welcome_benefits (user_id, status, created_at desc);

create unique index if not exists ai_credit_ledger_welcome_upload_unique_idx
  on public.ai_credit_ledger (user_id, source, reason)
  where source = 'welcome' and reason = 'welcome_upload_1';

create unique index if not exists premium_access_grants_welcome_24h_unique_idx
  on public.premium_access_grants (user_id, source, product_code)
  where source = 'welcome' and product_code = 'premium_24h';

drop trigger if exists user_welcome_benefits_set_updated_at on public.user_welcome_benefits;
create trigger user_welcome_benefits_set_updated_at
  before update on public.user_welcome_benefits
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.user_welcome_benefits enable row level security;

create policy "user_welcome_benefits_select_own"
  on public.user_welcome_benefits
  for select
  to authenticated
  using (auth.uid() = user_id);
