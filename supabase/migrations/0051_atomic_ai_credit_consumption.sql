with existing_consumptions as (
  select
    id,
    case
      when metadata ? 'learningStudySetId' then 'learning:' || (metadata ->> 'learningStudySetId')
      when metadata ? 'licentaSessionId' then 'licenta:' || (metadata ->> 'licentaSessionId')
      when metadata ? 'importJobId' then 'import:' || (metadata ->> 'importJobId')
      when metadata ? 'job_id' then 'question_bank:' || (metadata ->> 'job_id')
      else null
    end as consumption_key,
    row_number() over (
      partition by case
        when metadata ? 'learningStudySetId' then 'learning:' || (metadata ->> 'learningStudySetId')
        when metadata ? 'licentaSessionId' then 'licenta:' || (metadata ->> 'licentaSessionId')
        when metadata ? 'importJobId' then 'import:' || (metadata ->> 'importJobId')
        when metadata ? 'job_id' then 'question_bank:' || (metadata ->> 'job_id')
        else null
      end
      order by created_at asc, id asc
    ) as occurrence
  from public.ai_credit_ledger
  where source = 'generation'
    and reason = 'generation_consume'
    and delta < 0
    and not (metadata ? 'creditConsumptionKey')
)
update public.ai_credit_ledger as ledger
set metadata = ledger.metadata || jsonb_build_object(
  'creditConsumptionKey', existing_consumptions.consumption_key
)
from existing_consumptions
where ledger.id = existing_consumptions.id
  and existing_consumptions.consumption_key is not null
  and existing_consumptions.occurrence = 1;

create unique index if not exists ai_credit_ledger_consumption_key_unique_idx
  on public.ai_credit_ledger ((metadata ->> 'creditConsumptionKey'))
  where source = 'generation'
    and reason = 'generation_consume'
    and delta < 0
    and metadata ? 'creditConsumptionKey';

create or replace function public.consume_ai_credit(
  p_user_id uuid,
  p_cost integer,
  p_idempotency_key text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_existing_id uuid;
  v_ledger_id uuid;
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_cost is null or p_cost < 1 then
    raise exception 'INVALID_CREDIT_COST';
  end if;

  if v_key = '' or pg_catalog.length(v_key) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select ledger.id
    into v_existing_id
  from public.ai_credit_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.source = 'generation'
    and ledger.reason = 'generation_consume'
    and ledger.delta < 0
    and ledger.metadata ->> 'creditConsumptionKey' = v_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'consumed', false,
      'ledgerId', v_existing_id,
      'balance', public.get_ai_credit_balance(p_user_id)
    );
  end if;

  v_balance := public.get_ai_credit_balance(p_user_id);
  if v_balance < p_cost then
    raise exception 'INSUFFICIENT_AI_CREDITS';
  end if;

  insert into public.ai_credit_ledger (
    user_id,
    source,
    reason,
    delta,
    metadata
  )
  values (
    p_user_id,
    'generation',
    'generation_consume',
    -p_cost,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('creditConsumptionKey', v_key)
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'consumed', true,
    'ledgerId', v_ledger_id,
    'balance', v_balance - p_cost
  );
end;
$$;

revoke all on function public.consume_ai_credit(uuid, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.consume_ai_credit(uuid, integer, text, jsonb)
  to service_role;
