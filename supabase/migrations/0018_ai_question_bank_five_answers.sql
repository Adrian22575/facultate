alter table public.ai_question_bank_items
  drop constraint if exists ai_question_bank_items_correct_index_check;

alter table public.ai_question_bank_items
  drop constraint if exists ai_question_bank_items_answers_count_check;

alter table public.ai_question_bank_items
  add constraint ai_question_bank_items_answers_count_check
  check (
    jsonb_typeof(answers) = 'array'
    and jsonb_array_length(answers) between 4 and 5
  );

alter table public.ai_question_bank_items
  add constraint ai_question_bank_items_correct_index_check
  check (
    correct_index >= 0
    and jsonb_typeof(answers) = 'array'
    and correct_index < jsonb_array_length(answers)
  );
