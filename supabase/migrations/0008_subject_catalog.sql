create table if not exists public.subjects (
  id text primary key,
  title text not null,
  questions_file text,
  source text not null default 'user' check (source in ('seed', 'user', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subjects_title_not_blank check (char_length(trim(title)) >= 2)
);

create table if not exists public.subject_allocations (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id) on delete cascade,
  user_type text not null check (user_type in ('student', 'elev')),
  study_year smallint check (study_year between 1 and 10),
  semester smallint not null check (semester in (1, 2)),
  school_class text,
  source text not null default 'user' check (source in ('seed', 'user', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subject_allocations_context_check check (
    (
      user_type = 'student'
      and study_year is not null
      and school_class is null
    )
    or (
      user_type = 'elev'
      and study_year is null
      and nullif(trim(coalesce(school_class, '')), '') is not null
    )
  )
);

create index if not exists subjects_lookup_idx
  on public.subjects (lower(title));

create index if not exists subject_allocations_context_lookup_idx
  on public.subject_allocations (user_type, study_year, semester, lower(coalesce(school_class, '')));

create index if not exists subject_allocations_subject_lookup_idx
  on public.subject_allocations (subject_id, user_type, semester);

create unique index if not exists subject_allocations_student_unique
  on public.subject_allocations (subject_id, user_type, study_year, semester)
  where user_type = 'student';

create unique index if not exists subject_allocations_elev_unique
  on public.subject_allocations (subject_id, user_type, semester, lower(trim(school_class)))
  where user_type = 'elev';

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists subject_allocations_set_updated_at on public.subject_allocations;
create trigger subject_allocations_set_updated_at
  before update on public.subject_allocations
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.subjects enable row level security;
alter table public.subject_allocations enable row level security;

drop policy if exists "subjects_select_all" on public.subjects;
create policy "subjects_select_all"
  on public.subjects
  for select
  to authenticated
  using (true);

drop policy if exists "subjects_insert_authenticated" on public.subjects;
create policy "subjects_insert_authenticated"
  on public.subjects
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "subjects_update_creator" on public.subjects;
create policy "subjects_update_creator"
  on public.subjects
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "subject_allocations_select_all" on public.subject_allocations;
create policy "subject_allocations_select_all"
  on public.subject_allocations
  for select
  to authenticated
  using (true);

drop policy if exists "subject_allocations_insert_authenticated" on public.subject_allocations;
create policy "subject_allocations_insert_authenticated"
  on public.subject_allocations
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "subject_allocations_update_creator" on public.subject_allocations;
create policy "subject_allocations_update_creator"
  on public.subject_allocations
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

insert into public.subjects (id, title, questions_file, source)
values
  ('managementul-serviciilor', 'Managementul serviciilor', 'data/questions/managementul-serviciilor.json', 'seed'),
  ('managementul-calitatii', 'Managementul calitatii', 'data/questions/managementul-calitatii.json', 'seed'),
  ('econometrie', 'Econometrie', 'data/questions/econometrie.json', 'seed'),
  ('managementul-proiectelor', 'Managementul proiectelor', 'data/questions/managementul-proiectelor.json', 'seed'),
  ('managementul-resurselor-umane', 'Managementul resurselor umane', 'data/questions/managementul-resurselor-umane.json', 'seed'),
  ('comportament-organizational', 'Comportament organizational', 'data/questions/comportament-organizational.json', 'seed'),
  ('managementul-investitiilor', 'Managementul investitiilor', 'data/questions/managementul-investitiilor.json', 'seed'),
  ('management-international', 'Management international', 'data/questions/management-international.json', 'seed'),
  ('managementul-aprovizionarii-si-desfacerii', 'Managementul aprovizionarii si desfacerii', 'data/questions/managementul-aprovizionarii-si-desfacerii.json', 'seed'),
  ('managementul-productiei', 'Managementul productiei', 'data/questions/managementul-productiei.json', 'seed'),
  ('management-strategic', 'Management strategic', 'data/questions/management-strategic.json', 'seed'),
  ('analiza-economico-financiara', 'Analiza economico-financiara', 'data/questions/analiza-economico-financiara.json', 'seed'),
  ('management-financiar', 'Management financiar', 'data/questions/management-financiar.json', 'seed'),
  ('audit', 'Audit', 'data/questions/audit.json', 'seed'),
  ('baze-de-date-pentru-management', 'Baze de date pentru management', 'data/questions/baze-de-date-pentru-management.json', 'seed'),
  ('economia-intreprinderii', 'Economia intreprinderii', 'data/questions/economia-intreprinderii.json', 'seed'),
  ('management-comparat', 'Management comparat', 'data/questions/management-comparat.json', 'seed'),
  ('test', 'test', 'data/questions/test.json', 'seed')
on conflict (id) do update
set
  title = excluded.title,
  questions_file = excluded.questions_file;

insert into public.subject_allocations (
  subject_id,
  user_type,
  study_year,
  semester,
  school_class,
  source
)
select
  seed.subject_id,
  seed.user_type,
  seed.study_year,
  seed.semester,
  seed.school_class,
  seed.source
from (
  values
    ('managementul-serviciilor', 'student', 3, 1, null, 'seed'),
    ('managementul-calitatii', 'student', 3, 2, null, 'seed'),
    ('econometrie', 'student', 2, 2, null, 'seed'),
    ('managementul-proiectelor', 'student', 3, 1, null, 'seed'),
    ('managementul-resurselor-umane', 'student', 2, 1, null, 'seed'),
    ('comportament-organizational', 'student', 2, 1, null, 'seed'),
    ('managementul-investitiilor', 'student', 3, 2, null, 'seed'),
    ('management-international', 'student', 3, 2, null, 'seed'),
    ('managementul-aprovizionarii-si-desfacerii', 'student', 2, 2, null, 'seed'),
    ('managementul-productiei', 'student', 2, 2, null, 'seed'),
    ('management-strategic', 'student', 3, 2, null, 'seed'),
    ('analiza-economico-financiara', 'student', 3, 1, null, 'seed'),
    ('management-financiar', 'student', 3, 1, null, 'seed'),
    ('audit', 'student', 4, 1, null, 'seed'),
    ('baze-de-date-pentru-management', 'student', 1, 2, null, 'seed'),
    ('economia-intreprinderii', 'student', 1, 1, null, 'seed'),
    ('management-comparat', 'student', 4, 1, null, 'seed'),
    ('test', 'student', 2, 1, null, 'seed')
) as seed(subject_id, user_type, study_year, semester, school_class, source)
where not exists (
  select 1
  from public.subject_allocations existing
  where existing.subject_id = seed.subject_id
    and existing.user_type = seed.user_type
    and coalesce(existing.study_year, -1) = coalesce(seed.study_year, -1)
    and existing.semester = seed.semester
    and lower(coalesce(existing.school_class, '')) = lower(coalesce(seed.school_class, ''))
);
