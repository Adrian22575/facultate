update public.user_usage_events
set route_query = null
where route_query is not null;

update public.user_usage_events
set referrer_path = regexp_replace(referrer_path, '\?.*$', '')
where referrer_path like '%?%';

update public.user_usage_events
set route_path = case
  when route_path like '/r/%' then '/r/[code]'
  else regexp_replace(
    route_path,
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=/|$)',
    '/[id]',
    'gi'
  )
end
where route_path like '/r/%'
   or route_path ~* '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

update public.user_usage_events
set metadata = jsonb_set(
  metadata,
  '{href}',
  to_jsonb(
    regexp_replace(
      regexp_replace(metadata->>'href', '\?.*$', ''),
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=/|$)',
      '/[id]',
      'gi'
    )
  ),
  false
)
where metadata ? 'href'
  and metadata->>'href' like '%?%';
