-- Malakai Ravintola: varausjärjestelmän tietokanta.
-- Aja koko tiedosto Supabasen SQL Editorissa. Turvallista ajaa uudelleen.

create table if not exists reservations(
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  name text not null, email text, phone text not null, guests int not null, date date not null, time time not null,
  note text, status text not null default 'uusi');
alter table reservations add column if not exists handled_at timestamptz;
alter table reservations add column if not exists source text default 'verkko';

create table if not exists subscribers(
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  email text unique not null, name text);

create table if not exists templates(
  key text primary key, title text, subject text, body text, updated_at timestamptz default now());

alter table reservations enable row level security;
alter table subscribers enable row level security;
alter table templates enable row level security;

-- Vain ylläpitäjän sähköposti pääsee lukemaan ja muokkaamaan. Asiakkaat kirjoittavat vain palvelinfunktion kautta.
drop policy if exists admin_res on reservations;
drop policy if exists admin_sub on subscribers;
drop policy if exists admin_tpl on templates;
create policy admin_res on reservations for all to authenticated
  using ((auth.jwt()->>'email')='malakairavintola@gmail.com') with check ((auth.jwt()->>'email')='malakairavintola@gmail.com');
create policy admin_sub on subscribers for all to authenticated
  using ((auth.jwt()->>'email')='malakairavintola@gmail.com') with check ((auth.jwt()->>'email')='malakairavintola@gmail.com');
create policy admin_tpl on templates for all to authenticated
  using ((auth.jwt()->>'email')='malakairavintola@gmail.com') with check ((auth.jwt()->>'email')='malakairavintola@gmail.com');
