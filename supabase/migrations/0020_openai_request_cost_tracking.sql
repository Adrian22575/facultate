alter table public.openai_request_logs
  add column if not exists estimated_cost_usd numeric(12, 8),
  add column if not exists estimated_input_cost_usd numeric(12, 8),
  add column if not exists estimated_output_cost_usd numeric(12, 8),
  add column if not exists estimated_cached_input_cost_usd numeric(12, 8),
  add column if not exists pricing_status text
    check (pricing_status in ('estimated', 'zero_usage', 'pricing_missing')),
  add column if not exists pricing_version text,
  add column if not exists input_tokens integer check (input_tokens is null or input_tokens >= 0),
  add column if not exists output_tokens integer check (output_tokens is null or output_tokens >= 0),
  add column if not exists cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  add column if not exists reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  add column if not exists total_tokens integer check (total_tokens is null or total_tokens >= 0);

create index if not exists openai_request_logs_pricing_status_idx
  on public.openai_request_logs (pricing_status, created_at desc);

create index if not exists openai_request_logs_estimated_cost_idx
  on public.openai_request_logs (estimated_cost_usd desc nulls last, created_at desc);
