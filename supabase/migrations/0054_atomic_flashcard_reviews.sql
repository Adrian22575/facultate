create or replace function public.record_learning_flashcard_review(
  p_user_id uuid,
  p_study_set_id uuid,
  p_flashcard_id uuid,
  p_rating text,
  p_next_review_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review public.learning_flashcard_reviews%rowtype;
begin
  if p_rating not in ('nu_stiu', 'aproape', 'stiu', 'mai_tarziu') then
    raise exception 'INVALID_FLASHCARD_RATING';
  end if;

  insert into public.learning_flashcard_reviews (
    study_set_id,
    flashcard_id,
    user_id,
    rating,
    review_count,
    next_review_at,
    metadata
  )
  values (
    p_study_set_id,
    p_flashcard_id,
    p_user_id,
    p_rating,
    1,
    p_next_review_at,
    pg_catalog.jsonb_build_object('lastRatedAt', pg_catalog.now())
  )
  on conflict (flashcard_id, user_id)
  do update
  set rating = excluded.rating,
      review_count = public.learning_flashcard_reviews.review_count + 1,
      next_review_at = excluded.next_review_at,
      metadata = pg_catalog.jsonb_build_object('lastRatedAt', pg_catalog.now())
  returning * into v_review;

  if v_review.study_set_id <> p_study_set_id then
    raise exception 'FLASHCARD_STUDY_SET_MISMATCH';
  end if;

  return pg_catalog.jsonb_build_object(
    'flashcardId', v_review.flashcard_id,
    'rating', v_review.rating,
    'reviewCount', v_review.review_count,
    'nextReviewAt', v_review.next_review_at
  );
end;
$$;

revoke execute on function public.record_learning_flashcard_review(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_learning_flashcard_review(
  uuid, uuid, uuid, text, timestamptz
) to service_role;
