insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-source-documents',
  'private-source-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_select_own_source_documents" on storage.objects;
create policy "storage_select_own_source_documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_insert_own_source_documents" on storage.objects;
create policy "storage_insert_own_source_documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_update_own_source_documents" on storage.objects;
create policy "storage_update_own_source_documents"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_delete_own_source_documents" on storage.objects;
create policy "storage_delete_own_source_documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'private-source-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
