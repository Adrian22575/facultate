alter table public.ai_question_bank_items
  drop constraint if exists ai_question_bank_items_quality_status_check;

alter table public.ai_question_bank_items
  add constraint ai_question_bank_items_quality_status_check
  check (quality_status in ('accepted', 'needs_review', 'retry', 'rejected'));
