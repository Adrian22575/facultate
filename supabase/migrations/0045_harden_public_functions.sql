revoke all on function public.can_access_learning_study_set(uuid)
  from public, anon;
grant execute on function public.can_access_learning_study_set(uuid)
  to authenticated, service_role;

revoke all on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer, text, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer, text, uuid, uuid, uuid, text, smallint, smallint, text, text, text)
  from public, anon, authenticated;

grant execute on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer)
  to service_role;
grant execute on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer, text, uuid, uuid, uuid)
  to service_role;
grant execute on function public.create_generated_test_draft(uuid, uuid, text, text, jsonb, integer, text, uuid, uuid, uuid, text, smallint, smallint, text, text, text)
  to service_role;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
grant execute on function public.handle_new_user()
  to service_role;

alter function public.set_current_timestamp_updated_at()
  set search_path = public;
alter function public.get_ai_credit_balance(uuid)
  set search_path = public;
alter function public.user_has_active_premium(uuid)
  set search_path = public;
alter function public.normalize_ro_phone(text)
  set search_path = public;
alter function public.set_profile_phone_normalized()
  set search_path = public;
