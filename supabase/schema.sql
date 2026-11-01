create table reservations(
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  name text not null, email text, phone text not null, guests int not null, date date not null, time time not null,
  note text, status text not null default 'uusi');
create table subscribers(
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  email text unique not null, name text);
alter table reservations enable row level security;
alter table subscribers enable row level security;
-- Vain ylläpitäjän sähköposti pääsee lukemaan ja muokkaamaan. Asiakkaat kirjoittavat vain funktion kautta.
create policy admin_res on reservations for all to authenticated
  using ((auth.jwt()->>'email')='malakairavintola@gmail.com') with check ((auth.jwt()->>'email')='malakairavintola@gmail.com');
create policy admin_sub on subscribers for all to authenticated
  using ((auth.jwt()->>'email')='malakairavintola@gmail.com') with check ((auth.jwt()->>'email')='malakairavintola@gmail.com');
