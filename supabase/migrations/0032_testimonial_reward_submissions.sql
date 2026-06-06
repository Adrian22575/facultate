alter table public.premium_access_grants
  drop constraint if exists premium_access_grants_source_check;

alter table public.premium_access_grants
  add constraint premium_access_grants_source_check
  check (source in ('stripe', 'admin', 'manual', 'welcome', 'referral', 'testimonial'));

alter table public.ai_credit_ledger
  drop constraint if exists ai_credit_ledger_source_check;

alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_source_check
  check (source in ('stripe', 'generation', 'admin', 'manual', 'welcome', 'testimonial'));

alter table public.ai_credit_ledger
  drop constraint if exists ai_credit_ledger_reason_check;

alter table public.ai_credit_ledger
  add constraint ai_credit_ledger_reason_check
  check (reason in ('ai_upload_1', 'ai_upload_5', 'generation_consume', 'manual_adjustment', 'welcome_upload_1', 'testimonial_reward_upload'));

create table if not exists public.testimonial_reward_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reward_type text not null check (reward_type in ('ai_upload_1', 'premium_24h')),
  answers jsonb not null,
  generated_testimonial text not null,
  edited_testimonial text not null,
  public_testimonial text,
  admin_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  reward_granted_at timestamptz,
  reward_credit_ledger_id uuid references public.ai_credit_ledger(id) on delete set null,
  reward_premium_grant_id uuid references public.premium_access_grants(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint testimonial_reward_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint testimonial_reward_pending_has_no_reward
    check ((status = 'approved' and approved_at is not null) or status <> 'approved')
);

create index if not exists testimonial_reward_user_status_idx
  on public.testimonial_reward_submissions (user_id, status, created_at desc);

create index if not exists testimonial_reward_status_created_idx
  on public.testimonial_reward_submissions (status, created_at desc);

create unique index if not exists testimonial_reward_pending_user_unique_idx
  on public.testimonial_reward_submissions (user_id)
  where status = 'pending';

create unique index if not exists testimonial_reward_granted_user_unique_idx
  on public.testimonial_reward_submissions (user_id)
  where reward_granted_at is not null;

create unique index if not exists ai_credit_ledger_testimonial_reward_unique_idx
  on public.ai_credit_ledger ((metadata ->> 'testimonialRewardSubmissionId'))
  where source = 'testimonial' and metadata ? 'testimonialRewardSubmissionId';

create unique index if not exists premium_access_grants_testimonial_reward_unique_idx
  on public.premium_access_grants ((metadata ->> 'testimonialRewardSubmissionId'))
  where source = 'testimonial' and metadata ? 'testimonialRewardSubmissionId';

drop trigger if exists testimonial_reward_submissions_set_updated_at on public.testimonial_reward_submissions;
create trigger testimonial_reward_submissions_set_updated_at
  before update on public.testimonial_reward_submissions
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.testimonial_reward_submissions enable row level security;

create policy "testimonial_reward_select_own"
  on public.testimonial_reward_submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "testimonial_reward_insert_own"
  on public.testimonial_reward_submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');
