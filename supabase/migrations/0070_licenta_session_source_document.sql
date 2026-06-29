alter table public.ai_licenta_import_sessions
  add column if not exists source_document_id uuid references public.ai_source_documents(id) on delete set null;

create index if not exists ai_licenta_import_sessions_source_document_idx
  on public.ai_licenta_import_sessions (source_document_id)
  where source_document_id is not null;
