create unique index if not exists learning_study_sets_user_idempotency_key_unique_idx
  on public.learning_study_sets (user_id, (metadata->>'idempotencyKey'))
  where metadata ? 'idempotencyKey';
