revoke all on function public.configure_editorial_scheduler_token(text) from public;
revoke all on function public.configure_editorial_scheduler_token(text) from anon;
revoke all on function public.configure_editorial_scheduler_token(text) from authenticated;
grant execute on function public.configure_editorial_scheduler_token(text) to service_role;
