alter table public.learning_study_sets
  add column if not exists content_hash text;

create index if not exists learning_study_sets_community_content_hash_idx
  on public.learning_study_sets (
    content_hash,
    visibility_scope,
    target_cohort_id,
    target_unit_id,
    target_institution_id,
    published_at desc
  )
  where content_hash is not null
    and published_at is not null
    and visibility_scope <> 'private'
    and status in ('ready', 'ready_with_warnings');
