drop policy if exists "ai_question_banks_delete_owner" on public.ai_question_banks;
create policy "ai_question_banks_delete_owner"
on public.ai_question_banks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_question_bank_items_delete_owner" on public.ai_question_bank_items;
create policy "ai_question_bank_items_delete_owner"
on public.ai_question_bank_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.ai_question_banks bank
    where bank.id = ai_question_bank_items.bank_id
      and bank.user_id = auth.uid()
  )
);
