-- Edițiile noi sunt inserate înainte de a primi opțiunile alese în Admin.
-- Valoarea veche `practical_brief` nu mai este permisă de constrângerea actuală.
alter table public.linkedin_editorial_posts
  alter column template_key set default 'what_matters_now';
