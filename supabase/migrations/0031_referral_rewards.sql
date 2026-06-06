alter table public.premium_access_grants
  drop constraint if exists premium_access_grants_source_check;

alter table public.premium_access_grants
  add constraint premium_access_grants_source_check
  check (source in ('stripe', 'admin', 'manual', 'welcome', 'referral'));

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null;

create table if not exists public.user_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'rewarded', 'invalid')),
  referral_code text not null,
  reward_product_code text not null default 'premium_24h' check (reward_product_code in ('premium_24h')),
  reward_grant_id uuid references public.premium_access_grants(id) on delete set null,
  activated_at timestamptz,
  rewarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_referrals_distinct_users check (referrer_user_id <> referred_user_id),
  constraint user_referrals_referred_unique unique (referred_user_id)
);

create index if not exists user_referrals_referrer_status_idx
  on public.user_referrals (referrer_user_id, status, created_at desc);

create index if not exists user_referrals_referred_status_idx
  on public.user_referrals (referred_user_id, status, created_at desc);

create unique index if not exists premium_access_grants_referral_unique_idx
  on public.premium_access_grants ((metadata ->> 'referralId'))
  where source = 'referral' and metadata ? 'referralId';

drop trigger if exists user_referrals_set_updated_at on public.user_referrals;
create trigger user_referrals_set_updated_at
  before update on public.user_referrals
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.user_referrals enable row level security;

create policy "user_referrals_select_related"
  on public.user_referrals
  for select
  to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);
