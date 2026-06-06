alter table public.ai_question_banks
  drop constraint if exists ai_question_banks_status_check;

alter table public.ai_question_banks
  add constraint ai_question_banks_status_check
  check (status in ('processing', 'review', 'published', 'failed', 'archived'));

drop policy if exists "ai_question_banks_update_own" on public.ai_question_banks;
create policy "ai_question_banks_update_own"
  on public.ai_question_banks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ai_question_bank_items_update_own" on public.ai_question_bank_items;
create policy "ai_question_bank_items_update_own"
  on public.ai_question_bank_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ai_question_banks b
      where b.id = bank_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.ai_question_banks b
      where b.id = bank_id
        and b.user_id = auth.uid()
    )
  );
