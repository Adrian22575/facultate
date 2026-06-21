alter table public.learning_flashcard_reviews
  add column if not exists metadata jsonb not null default '{}'::jsonb;
