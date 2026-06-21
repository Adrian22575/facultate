do $$
declare
  fk record;
begin
  for fk in
    select
      n.nspname as schema_name,
      t.relname as table_name,
      c.conname as constraint_name,
      string_agg(format('%I', a.attname), ', ' order by k.ordinality) as column_list
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ordinality)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] = c.conkey
      )
    group by n.nspname, t.relname, c.conname
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      left(fk.constraint_name || '_idx', 63),
      fk.schema_name,
      fk.table_name,
      fk.column_list
    );
  end loop;
end;
$$;

do $$
declare
  policy_row record;
  using_clause text;
  check_clause text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual like '%auth.uid()%' and qual not ilike '%select auth.uid()%')
        or (with_check like '%auth.uid()%' and with_check not ilike '%select auth.uid()%')
      )
  loop
    using_clause := case
      when policy_row.qual is null then ''
      else format(' using (%s)', replace(policy_row.qual, 'auth.uid()', '(select auth.uid())'))
    end;
    check_clause := case
      when policy_row.with_check is null then ''
      else format(' with check (%s)', replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())'))
    end;

    execute format(
      'alter policy %I on %I.%I%s%s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      using_clause,
      check_clause
    );
  end loop;
end;
$$;
