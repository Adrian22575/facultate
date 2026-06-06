create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_type text check (user_type in ('student', 'elev')),
  feedback_type text not null check (feedback_type in ('problem', 'feature', 'idea')),
  message text not null,
  optional_detail text,
  page_path text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists feedback_submissions_user_created_idx
  on public.feedback_submissions (user_id, created_at desc);

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_submissions_insert_own" on public.feedback_submissions;
create policy "feedback_submissions_insert_own"
  on public.feedback_submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id);
