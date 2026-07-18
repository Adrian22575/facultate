alter table public.linkedin_editorial_posts
  add column if not exists edition_number integer not null default 1;

alter table public.linkedin_editorial_posts
  add constraint linkedin_editorial_posts_edition_number_check
  check (edition_number between 1 and 1000);

alter table public.linkedin_editorial_posts
  drop constraint if exists linkedin_editorial_posts_article_id_connection_id_key;

alter table public.linkedin_editorial_posts
  add constraint linkedin_editorial_posts_article_connection_edition_key
  unique (article_id, connection_id, edition_number);

create index if not exists linkedin_editorial_posts_article_editions_idx
  on public.linkedin_editorial_posts (article_id, connection_id, edition_number desc);

comment on column public.linkedin_editorial_posts.edition_number is
  'Ediția postării pentru același articol și același profil LinkedIn; edițiile publicate rămân imuabile.';
