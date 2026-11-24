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

-- Uuden asiakkaan alennus, asiakasrekisteri ja palautepyynnöt (ajettu 24.11.2026)
alter table orders add column if not exists discount numeric(8,2) not null default 0;
alter table orders add column if not exists discount_note text;
alter table orders add column if not exists review_sent_at timestamptz;
create table if not exists customers(id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  email text unique not null, name text, phone text, address text, zip text, city text, orders int not null default 0,
  spent numeric(10,2) not null default 0, first_order timestamptz, last_order timestamptz, review_mail boolean not null default true);
alter table customers enable row level security;
-- Palautepyynnöt: pg_cron ajaa public.run_review_mails() 5 min välein (työn nimi: palautepyynnot).
alter table orders add column if not exists pay text not null default 'kortti'; -- kortti | kateinen

-- Vain omistaja voi omistaa tunnuksen: estää kaikki muut rekisteröitymiset tietokantatasolla
create or replace function public.only_owner_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email,'')) <> 'hardi7fateh@hotmail.com' then raise exception 'Rekisteröityminen ei ole sallittu'; end if;
  return new;
end $$;
revoke all on function public.only_owner_signup() from public, anon, authenticated;
drop trigger if exists only_owner_signup on auth.users;
create trigger only_owner_signup before insert or update of email on auth.users for each row execute function public.only_owner_signup();

-- Asiakastilit (2026-11-24): rekisteröityminen sallittu, omistajan sivut suojattu RLS:llä omistajan sähköpostiin.
-- Asiakas näkee vain omat tilauksensa ja asiakasrivinsä, ja vain vahvistetulla sähköpostilla.
drop trigger if exists only_owner_signup on auth.users;
drop function if exists public.only_owner_signup();
create or replace function public.my_email() returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null $$;
revoke all on function public.my_email() from public, anon; grant execute on function public.my_email() to authenticated;
create policy cust_own_orders on public.orders for select to authenticated using (public.my_email() is not null and lower(email) = public.my_email());
create policy cust_own_row on public.customers for select to authenticated using (public.my_email() is not null and lower(email) = public.my_email());
