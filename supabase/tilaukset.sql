-- Malakai Ravintola: nettitilaukset. Aja Supabasen SQL Editorissa. Turvallista ajaa uudelleen.
create table if not exists orders(
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  created_at timestamptz default now(),
  name text not null, phone text not null, email text not null,
  kind text not null default 'nouto',            -- nouto | kuljetus
  address text, zip text, city text,
  want text not null default 'heti',              -- heti | HH:MM
  items jsonb not null, subtotal numeric(8,2) not null, fee numeric(8,2) not null default 0, total numeric(8,2) not null,
  note text,
  status text not null default 'uusi',            -- uusi | hyvaksytty | valmis | luovutettu | peruttu
  eta text, reason text, handled_at timestamptz, done_at timestamptz);
create index if not exists orders_created on orders(created_at desc);

create table if not exists settings(key text primary key, value jsonb not null, updated_at timestamptz default now());
insert into settings(key,value) values('orders','{"on":false,"delivery":false,"fee":4.9,"min":20,"area":"Sääksjärvi ja lähialue","prep":20,"dtime":45,"note":""}')
  on conflict (key) do nothing;

alter table orders enable row level security;
alter table settings enable row level security;
drop policy if exists admin_orders on orders;
drop policy if exists admin_settings on settings;
create policy admin_orders on orders for all to authenticated
  using ((auth.jwt()->>'email')='hardi7fateh@hotmail.com') with check ((auth.jwt()->>'email')='hardi7fateh@hotmail.com');
create policy admin_settings on settings for all to authenticated
  using ((auth.jwt()->>'email')='hardi7fateh@hotmail.com') with check ((auth.jwt()->>'email')='hardi7fateh@hotmail.com');
