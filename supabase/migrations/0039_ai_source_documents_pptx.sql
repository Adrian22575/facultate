alter table public.ai_source_documents
  drop constraint if exists ai_source_documents_source_kind_check;

alter table public.ai_source_documents
  add constraint ai_source_documents_source_kind_check
  check (source_kind in ('pdf', 'docx', 'pptx', 'txt', 'manual'));
