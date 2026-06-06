-- Seed starter specializations for university faculties.
-- These are common Romanian undergraduate program names, grouped by faculty domain.
-- They keep onboarding usable from the first run while users can still add missing programs.

with program_rules (name_pattern, program_name) as (
  values
    ('%Administrație și Afaceri%', 'Administrarea afacerilor'),
    ('%Administrație și Afaceri%', 'Administrație publică'),
    ('%Administrație și Afaceri%', 'Marketing'),
    ('%Administrarea Afacerilor%', 'Administrarea afacerilor'),
    ('%Administrarea Afacerilor%', 'Management'),
    ('%Administrație și Management Public%', 'Administrație publică'),
    ('%Administrație și Management Public%', 'Resurse umane'),
    ('%Economie%', 'Economie și afaceri internaționale'),
    ('%Economie%', 'Management'),
    ('%Economie%', 'Marketing'),
    ('%Economice%', 'Contabilitate și informatică de gestiune'),
    ('%Economice%', 'Finanțe și bănci'),
    ('%Economice%', 'Management'),
    ('%Business%', 'Administrarea afacerilor'),
    ('%Business%', 'Business internațional'),
    ('%Management%', 'Management'),
    ('%Management%', 'Inginerie economică industrială'),
    ('%Marketing%', 'Marketing'),
    ('%Finanțe%', 'Finanțe și bănci'),
    ('%Contabilitate%', 'Contabilitate și informatică de gestiune'),
    ('%Relații Economice Internaționale%', 'Economie și afaceri internaționale'),
    ('%Relații Economice Internaționale%', 'Limbi moderne aplicate'),
    ('%Cibernetică%', 'Cibernetică economică'),
    ('%Cibernetică%', 'Statistică și previziune economică'),
    ('%Cibernetică%', 'Informatică economică'),
    ('%Turism%', 'Economia comerțului, turismului și serviciilor'),
    ('%Agroalimentară%', 'Economie agroalimentară și a mediului'),

    ('%Automatică%', 'Automatică și informatică aplicată'),
    ('%Automatică%', 'Calculatoare'),
    ('%Calculatoare%', 'Calculatoare'),
    ('%Calculatoare%', 'Tehnologia informației'),
    ('%Informatică%', 'Informatică'),
    ('%Informatică%', 'Calculatoare și tehnologia informației'),
    ('%Tehnologia Informației%', 'Tehnologia informației'),
    ('%Telecomunicații%', 'Electronică aplicată'),
    ('%Telecomunicații%', 'Rețele și software de telecomunicații'),
    ('%Electronică%', 'Electronică aplicată'),
    ('%Electronică%', 'Telecomunicații'),
    ('%Știința Calculatoarelor%', 'Calculatoare'),
    ('%Știința Calculatoarelor%', 'Informatică aplicată'),

    ('%Matematică%', 'Matematică'),
    ('%Matematică%', 'Matematică informatică'),
    ('%Fizică%', 'Fizică'),
    ('%Fizică%', 'Fizică informatică'),
    ('%Chimie%', 'Chimie'),
    ('%Chimie%', 'Biochimie tehnologică'),
    ('%Biologie%', 'Biologie'),
    ('%Biologie%', 'Biochimie'),
    ('%Științe Biologice%', 'Biologie'),
    ('%Științe Biologice%', 'Biochimie'),
    ('%Geografie%', 'Geografie'),
    ('%Geografie%', 'Geografia turismului'),
    ('%Geologie%', 'Geologie'),
    ('%Geologie%', 'Inginerie geologică'),
    ('%Mediu%', 'Știința mediului'),
    ('%Mediu%', 'Ingineria mediului'),
    ('%Naturii%', 'Ecologie și protecția mediului'),
    ('%Naturii%', 'Biologie'),
    ('%Agricole%', 'Agricultură'),
    ('%Agronomie%', 'Agricultură'),
    ('%Agronomie%', 'Montanologie'),
    ('%Horticultură%', 'Horticultură'),
    ('%Horticultură%', 'Peisagistică'),

    ('%Drept%', 'Drept'),
    ('%Drept%', 'Administrație publică'),
    ('%Științe Administrative%', 'Administrație publică'),
    ('%Științe Administrative%', 'Asistență managerială și administrativă'),
    ('%Politice%', 'Științe politice'),
    ('%Politice%', 'Relații internaționale și studii europene'),
    ('%Guvernării%', 'Administrație publică'),
    ('%Guvernării%', 'Comunicare și relații publice'),
    ('%Studii Europene%', 'Studii europene'),
    ('%Studii Europene%', 'Relații internaționale și studii europene'),
    ('%Filosofie%', 'Filosofie'),
    ('%Filosofie%', 'Științe politice'),
    ('%Sociologie%', 'Sociologie'),
    ('%Sociologie%', 'Asistență socială'),
    ('%Asistență Socială%', 'Asistență socială'),
    ('%Psihologie%', 'Psihologie'),
    ('%Psihologie%', 'Pedagogie'),
    ('%Științele Educației%', 'Pedagogie'),
    ('%Științele Educației%', 'Psihopedagogie specială'),
    ('%Științe ale Educației%', 'Pedagogie'),
    ('%Științe ale Educației%', 'Psihopedagogie specială'),
    ('%Comunicării%', 'Comunicare și relații publice'),
    ('%Comunicării%', 'Jurnalism'),
    ('%Jurnalism%', 'Jurnalism'),
    ('%Jurnalism%', 'Comunicare și relații publice'),

    ('%Litere%', 'Limba și literatura română'),
    ('%Litere%', 'Limbi moderne aplicate'),
    ('%Limbi%', 'Limbi moderne aplicate'),
    ('%Limbi%', 'Traducere și interpretare'),
    ('%Istorie%', 'Istorie'),
    ('%Istorie%', 'Relații internaționale și studii europene'),
    ('%Teologie Ortodoxă%', 'Teologie ortodoxă pastorală'),
    ('%Teologie Ortodoxă%', 'Artă sacră'),
    ('%Teologie Romano-Catolică%', 'Teologie romano-catolică pastorală'),
    ('%Teologie Greco-Catolică%', 'Teologie greco-catolică pastorală'),
    ('%Teologie Reformată%', 'Teologie reformată pastorală'),
    ('%Teologie%', 'Teologie pastorală'),
    ('%Muzică%', 'Muzică'),
    ('%Muzică%', 'Artele spectacolului'),
    ('%Teatru%', 'Artele spectacolului'),
    ('%Teatru%', 'Cinematografie și media'),
    ('%Arte%', 'Arte plastice'),
    ('%Arte%', 'Design'),
    ('%Design%', 'Design industrial'),
    ('%Design%', 'Design de produs'),

    ('%Educație Fizică%', 'Educație fizică și sportivă'),
    ('%Educație Fizică%', 'Kinetoterapie și motricitate specială'),
    ('%Sport%', 'Educație fizică și sportivă'),
    ('%Sport%', 'Kinetoterapie și motricitate specială'),

    ('%Medicină Dentară%', 'Medicină dentară'),
    ('%Stomatologie%', 'Medicină dentară'),
    ('%Stomatologie%', 'Tehnică dentară'),
    ('%Farmacie%', 'Farmacie'),
    ('%Farmacie%', 'Nutriție și dietetică'),
    ('%Moașe%', 'Asistență medicală generală'),
    ('%Moașe%', 'Moașe'),
    ('%Asistență Medicală%', 'Asistență medicală generală'),
    ('%Medicină%', 'Medicină'),
    ('%Medicină%', 'Asistență medicală generală'),
    ('%Științe Medicale%', 'Asistență medicală generală'),
    ('%Științe Medicale%', 'Balneofiziokinetoterapie și recuperare'),

    ('%Inginerie Electrică%', 'Inginerie electrică'),
    ('%Inginerie Electrică%', 'Electromecanică'),
    ('%Energetică%', 'Energetică și tehnologii informatice'),
    ('%Energetică%', 'Ingineria sistemelor electroenergetice'),
    ('%Electroenergetică%', 'Ingineria sistemelor electroenergetice'),
    ('%Electrotehnică%', 'Inginerie electrică'),
    ('%Mecanică%', 'Inginerie mecanică'),
    ('%Mecanică%', 'Autovehicule rutiere'),
    ('%Mecatronică%', 'Mecatronică'),
    ('%Robotică%', 'Robotică'),
    ('%Industrială%', 'Inginerie industrială'),
    ('%Industrială%', 'Tehnologia construcțiilor de mașini'),
    ('%Transporturi%', 'Transporturi'),
    ('%Transporturi%', 'Ingineria transporturilor și a traficului'),
    ('%Aerospațială%', 'Inginerie aerospațială'),
    ('%Materialelor%', 'Știința materialelor'),
    ('%Materialelor%', 'Ingineria materialelor'),
    ('%Inginerie Chimică%', 'Inginerie chimică'),
    ('%Biotehnologii%', 'Biotehnologii industriale'),
    ('%Inginerie Medicală%', 'Inginerie medicală'),
    ('%Construcții%', 'Construcții civile, industriale și agricole'),
    ('%Construcții%', 'Căi ferate, drumuri și poduri'),
    ('%Arhitectură%', 'Arhitectură'),
    ('%Urbanism%', 'Urbanism'),
    ('%Navală%', 'Arhitectură navală'),
    ('%Alimentară%', 'Ingineria produselor alimentare'),
    ('%Alimentară%', 'Controlul și expertiza produselor alimentare'),
    ('%Silvicultură%', 'Silvicultură'),
    ('%Silvicultură%', 'Exploatări forestiere'),
    ('%Lemnului%', 'Ingineria lemnului'),
    ('%Mobilier%', 'Design de mobilier'),
    ('%Petrolului%', 'Ingineria petrolului și gazelor'),
    ('%Gazelor%', 'Ingineria petrolului și gazelor'),
    ('%Petrochimie%', 'Prelucrarea petrolului și petrochimie'),
    ('%Tehnologică%', 'Inginerie și management'),
    ('%Transfrontalieră%', 'Relații internaționale și studii europene'),
    ('%Transfrontalieră%', 'Comunicare și relații publice'),
    ('%Științe Aplicate%', 'Fizică tehnologică'),
    ('%Științe Aplicate%', 'Chimie tehnologică'),
    ('%Științe%', 'Informatică aplicată'),
    ('%Științe%', 'Matematică informatică')
),
seed_faculties as (
  select
    faculty.id,
    faculty.institution_id,
    faculty.name
  from public.academic_units faculty
  join public.institutions institution
    on institution.id = faculty.institution_id
  where institution.institution_type = 'university'
    and faculty.unit_type = 'faculty'
    and faculty.parent_unit_id is null
    and faculty.source = 'seed'
),
matched_programs as (
  select distinct
    seed_faculties.id as faculty_id,
    seed_faculties.institution_id,
    program_rules.program_name
  from seed_faculties
  join program_rules
    on lower(seed_faculties.name) like lower(program_rules.name_pattern)
),
fallback_programs as (
  select
    seed_faculties.id as faculty_id,
    seed_faculties.institution_id,
    'Specializare generală' as program_name
  from seed_faculties
  where not exists (
    select 1
    from matched_programs
    where matched_programs.faculty_id = seed_faculties.id
  )
),
seed_programs as (
  select * from matched_programs
  union
  select * from fallback_programs
)
insert into public.academic_units (
  institution_id,
  parent_unit_id,
  unit_type,
  name,
  source
)
select
  seed_programs.institution_id,
  seed_programs.faculty_id,
  'program',
  seed_programs.program_name,
  'seed'
from seed_programs
where not exists (
  select 1
  from public.academic_units existing
  where existing.institution_id = seed_programs.institution_id
    and existing.parent_unit_id = seed_programs.faculty_id
    and existing.unit_type = 'program'
    and lower(existing.name) = lower(seed_programs.program_name)
);
