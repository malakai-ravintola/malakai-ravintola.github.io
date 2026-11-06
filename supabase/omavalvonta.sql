-- Omavalvonta: lämpötilakirjaukset (kylmälaitteet, astianpesukone, kebab ja riisi, buffet).
-- Aja tämä kerran Supabasen SQL Editorissa.

create table if not exists omavalvonta(
  id text primary key,
  lomake text not null check (lomake in ('kylma','pesu','ruoka','buffet')),
  pvm date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists omavalvonta_lomake_pvm on omavalvonta(lomake,pvm);
alter table omavalvonta enable row level security;

-- Vain ylläpitäjä lukee ja kirjaa.
drop policy if exists admin_omav on omavalvonta;
create policy admin_omav on omavalvonta for all to authenticated
  using ((auth.jwt()->>'email')='hardi7fateh@hotmail.com') with check ((auth.jwt()->>'email')='hardi7fateh@hotmail.com');

-- Ensimmäiset kirjaukset 7.11.2026
insert into omavalvonta(id,lomake,pvm,data) values
 ('kylma/2026-11-07','kylma','2026-11-07','{"jk1":"+6","jk2":"+6","vl1":"+5,9","vl2":"+6","pp1":"-21","ap1":"-22","ap2":"-21","ap3":"ei käytössä","kuittaus":"","huom":"Seuranta aloitettu"}'),
 ('pesu/2026-11-07','pesu','2026-11-07','{"pesu":"63","huuhtelu":"85","kuittaus":"","huom":"Seuranta aloitettu"}'),
 ('ruoka/2026-11-07','ruoka','2026-11-07','{"kebabKlo":"11.00","kebab":"+76","riisiKlo":"11.30","riisi":"+67","kuittaus":"","huom":"Seuranta aloitettu"}'),
 ('buffet/2026-11-07/1030','buffet','2026-11-07','{"ruoka":"","klo":"10.30","temp":"+73","kuittaus":"","huom":""}')
on conflict (id) do nothing;
