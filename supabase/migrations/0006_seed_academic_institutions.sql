with seed_institutions (institution_type, name, city, county) as (
  values
    ('university', 'UNIVERSITATEA DIN BUCUREȘTI', 'București', 'București'),
    ('university', 'UNIVERSITATEA NAȚIONALĂ DE ȘTIINȚĂ ȘI TEHNOLOGIE POLITEHNICA BUCUREȘTI', 'București', 'București'),
    ('university', 'ACADEMIA DE STUDII ECONOMICE DIN BUCUREȘTI', 'București', 'București'),
    ('university', 'UNIVERSITATEA DE MEDICINĂ ȘI FARMACIE "CAROL DAVILA" DIN BUCUREȘTI', 'București', 'București'),
    ('university', 'UNIVERSITATEA BABEȘ-BOLYAI DIN CLUJ-NAPOCA', 'Cluj-Napoca', 'Cluj'),
    ('university', 'UNIVERSITATEA "ALEXANDRU IOAN CUZA" DIN IAȘI', 'Iași', 'Iași'),
    ('university', 'UNIVERSITATEA DE VEST DIN TIMIȘOARA', 'Timișoara', 'Timiș'),
    ('university', 'UNIVERSITATEA POLITEHNICA TIMIȘOARA', 'Timișoara', 'Timiș'),
    ('university', 'UNIVERSITATEA "TRANSILVANIA" DIN BRAȘOV', 'Brașov', 'Brașov'),
    ('university', 'UNIVERSITATEA "OVIDIUS" DIN CONSTANȚA', 'Constanța', 'Constanța'),
    ('university', 'UNIVERSITATEA DIN CRAIOVA', 'Craiova', 'Dolj'),
    ('university', 'UNIVERSITATEA DIN ORADEA', 'Oradea', 'Bihor'),
    ('university', 'UNIVERSITATEA "LUCIAN BLAGA" DIN SIBIU', 'Sibiu', 'Sibiu'),
    ('university', 'UNIVERSITATEA "DUNĂREA DE JOS" DIN GALAȚI', 'Galați', 'Galați'),
    ('university', 'UNIVERSITATEA "ȘTEFAN CEL MARE" DIN SUCEAVA', 'Suceava', 'Suceava'),
    ('university', 'UNIVERSITATEA PETROL-GAZE DIN PLOIEȘTI', 'Ploiești', 'Prahova'),
    ('school', 'COLEGIUL NAȚIONAL "SFÂNTUL SAVA"', 'București', 'București'),
    ('school', 'COLEGIUL NAȚIONAL "GHEORGHE LAZĂR"', 'București', 'București'),
    ('school', 'COLEGIUL NAȚIONAL "EMIL RACOVIȚĂ"', 'Cluj-Napoca', 'Cluj'),
    ('school', 'COLEGIUL NAȚIONAL "GEORGE COȘBUC"', 'Cluj-Napoca', 'Cluj'),
    ('school', 'COLEGIUL NAȚIONAL IAȘI', 'Iași', 'Iași'),
    ('school', 'COLEGIUL NAȚIONAL "MIRCEA CEL BĂTRÂN"', 'Constanța', 'Constanța'),
    ('school', 'COLEGIUL NAȚIONAL "ANDREI ȘAGUNA"', 'Brașov', 'Brașov'),
    ('school', 'COLEGIUL NAȚIONAL "NIKOLAUS LENAU"', 'Timișoara', 'Timiș'),
    ('school', 'COLEGIUL NAȚIONAL "MATEI BASARAB"', 'Craiova', 'Dolj'),
    ('school', 'COLEGIUL NAȚIONAL "MIHAI EMINESCU"', 'Oradea', 'Bihor'),
    ('school', 'COLEGIUL NAȚIONAL "COSTACHE NEGRI"', 'Galați', 'Galați'),
    ('school', 'COLEGIUL NAȚIONAL "PETRU RAREȘ"', 'Suceava', 'Suceava')
)
insert into public.institutions (
  institution_type,
  name,
  city,
  county,
  source
)
select
  seed.institution_type,
  seed.name,
  seed.city,
  seed.county,
  'seed'
from seed_institutions seed
where not exists (
  select 1
  from public.institutions existing
  where existing.institution_type = seed.institution_type
    and lower(existing.name) = lower(seed.name)
    and coalesce(lower(existing.city), '') = coalesce(lower(seed.city), '')
);
