create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.premium_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('stripe', 'admin', 'manual')),
  product_code text not null check (product_code in ('premium_24h', 'premium_7d', 'premium_30d')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint premium_access_grants_date_order check (ends_at > starts_at)
);

create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('stripe', 'generation', 'admin', 'manual')),
  reason text not null check (reason in ('ai_upload_1', 'ai_upload_5', 'generation_consume', 'manual_adjustment')),
  delta integer not null check (delta <> 0),
  stripe_checkout_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_source_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('pdf', 'docx', 'txt', 'manual')),
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  extracted_text text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'succeeded', 'failed', 'rejected')),
  extraction_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_generated_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  prompt_version text,
  total_questions integer not null default 0 check (total_questions >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz
);

create table if not exists public.user_generated_test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.user_generated_tests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check (position > 0),
  question_text text not null,
  answers jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  explanation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_generated_test_questions_answers_array check (jsonb_typeof(answers) = 'array'),
  constraint user_generated_test_questions_position_unique unique (test_id, position)
);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_document_id uuid references public.ai_source_documents(id) on delete set null,
  generated_test_id uuid references public.user_generated_tests(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed')),
  credit_cost integer not null default 1 check (credit_cost > 0),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists premium_access_grants_user_id_idx
  on public.premium_access_grants (user_id, ends_at desc);

create index if not exists ai_credit_ledger_user_id_idx
  on public.ai_credit_ledger (user_id, created_at desc);

create index if not exists ai_source_documents_user_id_idx
  on public.ai_source_documents (user_id, created_at desc);

create index if not exists user_generated_tests_user_id_idx
  on public.user_generated_tests (user_id, created_at desc);

create index if not exists user_generated_test_questions_user_id_idx
  on public.user_generated_test_questions (user_id, test_id, position);

create index if not exists ai_generation_jobs_user_id_idx
  on public.ai_generation_jobs (user_id, created_at desc);

create or replace function public.get_ai_credit_balance(target_user_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(delta), 0)::integer
  from public.ai_credit_ledger
  where user_id = target_user_id;
$$;

create or replace function public.user_has_active_premium(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.premium_access_grants
    where user_id = target_user_id
      and starts_at <= timezone('utc', now())
      and ends_at > timezone('utc', now())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists ai_source_documents_set_updated_at on public.ai_source_documents;
create trigger ai_source_documents_set_updated_at
  before update on public.ai_source_documents
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists user_generated_tests_set_updated_at on public.user_generated_tests;
create trigger user_generated_tests_set_updated_at
  before update on public.user_generated_tests
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists user_generated_test_questions_set_updated_at on public.user_generated_test_questions;
create trigger user_generated_test_questions_set_updated_at
  before update on public.user_generated_test_questions
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.premium_access_grants enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_source_documents enable row level security;
alter table public.user_generated_tests enable row level security;
alter table public.user_generated_test_questions enable row level security;
alter table public.ai_generation_jobs enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "premium_access_grants_select_own"
  on public.premium_access_grants
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_credit_ledger_select_own"
  on public.ai_credit_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_source_documents_select_own"
  on public.ai_source_documents
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_source_documents_insert_own"
  on public.ai_source_documents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_source_documents_update_own"
  on public.ai_source_documents
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_source_documents_delete_own"
  on public.ai_source_documents
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "user_generated_tests_select_own"
  on public.user_generated_tests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_generated_tests_insert_own"
  on public.user_generated_tests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_generated_tests_update_own"
  on public.user_generated_tests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_generated_tests_delete_own"
  on public.user_generated_tests
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "user_generated_test_questions_select_own"
  on public.user_generated_test_questions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_generated_test_questions_insert_own"
  on public.user_generated_test_questions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_generated_tests
      where id = test_id
        and user_id = auth.uid()
    )
  );

create policy "user_generated_test_questions_update_own"
  on public.user_generated_test_questions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.user_generated_tests
      where id = test_id
        and user_id = auth.uid()
    )
  );

create policy "user_generated_test_questions_delete_own"
  on public.user_generated_test_questions
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_generation_jobs_select_own"
  on public.ai_generation_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-source-documents',
  'private-source-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_select_own_source_documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_insert_own_source_documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_update_own_source_documents"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_delete_own_source_documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
