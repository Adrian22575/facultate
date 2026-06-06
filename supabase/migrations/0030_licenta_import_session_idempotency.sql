create unique index if not exists ai_question_banks_licenta_session_unique_idx
  on public.ai_question_banks ((metadata->>'licentaSessionId'))
  where metadata ? 'licentaSessionId';
