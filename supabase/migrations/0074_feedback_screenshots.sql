alter table public.feedback_submissions
  add column if not exists screenshot_bucket text,
  add column if not exists screenshot_path text,
  add column if not exists screenshot_mime_type text,
  add column if not exists screenshot_size_bytes integer;

alter table public.feedback_submissions
  drop constraint if exists feedback_submissions_screenshot_metadata_check;

alter table public.feedback_submissions
  add constraint feedback_submissions_screenshot_metadata_check
  check (
    (screenshot_bucket is null and screenshot_path is null and screenshot_mime_type is null and screenshot_size_bytes is null)
    or (
      screenshot_bucket = 'feedback-screenshots'
      and screenshot_path is not null
      and screenshot_mime_type in ('image/png', 'image/jpeg', 'image/webp')
      and screenshot_size_bytes between 1 and 5242880
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
