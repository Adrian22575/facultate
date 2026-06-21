create or replace function public.consume_api_rate_limit(
  p_action text,
  p_subject text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt_count integer;
begin
  if length(trim(coalesce(p_action, ''))) not between 1 and 80
    or length(trim(coalesce(p_subject, ''))) not between 1 and 180
    or p_window_seconds not between 1 and 86400
    or p_max_requests not between 1 and 10000 then
    raise exception 'invalid_rate_limit_config';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_subject, 0));

  select count(*)::integer
    into attempt_count
    from public.api_rate_limit_events
   where action = p_action
     and subject = p_subject
     and created_at >= now() - make_interval(secs => p_window_seconds);

  if attempt_count >= p_max_requests then
    return query select false, 0, p_window_seconds;
    return;
  end if;

  insert into public.api_rate_limit_events (action, subject)
  values (p_action, p_subject);

  return query select true, greatest(0, p_max_requests - attempt_count - 1), 0;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
