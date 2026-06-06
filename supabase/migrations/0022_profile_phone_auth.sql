create or replace function public.normalize_ro_phone(input text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(input, ''), '\D', '', 'g');

  if digits = '' then
    return null;
  end if;

  if length(digits) = 13 and left(digits, 4) = '0040' then
    return '0' || substr(digits, 5);
  end if;

  if length(digits) = 11 and left(digits, 2) = '40' then
    return '0' || substr(digits, 3);
  end if;

  return digits;
end;
$$;

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists phone_normalized text;

update public.profiles
set phone_normalized = public.normalize_ro_phone(phone_number)
where phone_number is not null
  and phone_normalized is null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create unique index if not exists profiles_phone_normalized_unique_idx
  on public.profiles (phone_normalized)
  where phone_normalized is not null;

create or replace function public.set_profile_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_ro_phone(new.phone_number);
  return new;
end;
$$;

drop trigger if exists profiles_set_phone_normalized on public.profiles;
create trigger profiles_set_phone_normalized
  before insert or update of phone_number on public.profiles
  for each row execute procedure public.set_profile_phone_normalized();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone_number, phone_normalized)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone_number',
    public.normalize_ro_phone(new.raw_user_meta_data ->> 'phone_number')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
      phone_normalized = coalesce(excluded.phone_normalized, public.profiles.phone_normalized),
      updated_at = timezone('utc', now());

  return new;
end;
$$;
