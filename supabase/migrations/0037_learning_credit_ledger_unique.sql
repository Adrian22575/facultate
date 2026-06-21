create unique index if not exists ai_credit_ledger_learning_study_set_consume_unique_idx
  on public.ai_credit_ledger ((metadata->>'learningStudySetId'))
  where source = 'generation'
    and reason = 'generation_consume'
    and delta < 0
    and metadata ? 'learningStudySetId';
