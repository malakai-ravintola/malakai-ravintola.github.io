-- Malakai Ravintola: kävijätilastot (ei evästeitä, ei IP-osoitteita).
-- Aja koko tiedosto Supabasen SQL Editorissa. Turvallista ajaa uudelleen.

create table if not exists page_views(
  id bigserial primary key,
  created_at timestamptz not null default now(),
  day date not null default (now() at time zone 'Europe/Helsinki')::date,
  path text not null,
  source text not null default 'suora',
  device text not null default 'tietokone',
  visitor text not null);
create index if not exists page_views_day on page_views(day);
alter table page_views enable row level security;
drop policy if exists admin_pv on page_views;
create policy admin_pv on page_views for select to authenticated
  using ((auth.jwt()->>'email')='hardi7fateh@hotmail.com');

-- Tilastot ylläpitoon yhdellä kutsulla
create or replace function visit_stats() returns json
language plpgsql security definer set search_path = public as $$
declare t date := (now() at time zone 'Europe/Helsinki')::date; r json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'hardi7fateh@hotmail.com' then raise exception 'ei oikeutta'; end if;
  select json_build_object(
    'today', t,
    'periods', (select json_object_agg(k, json_build_object('views', v, 'visits', u)) from (
        select k, count(*) v, count(distinct visitor) u from page_views,
          lateral (values ('d1', t), ('d7', t-6), ('d30', t-29), ('d365', t-364)) p(k, f)
        where day >= f group by k) x),
    'daily', (select coalesce(json_agg(json_build_object('d', d, 'u', u, 'v', v) order by d), '[]') from (
        select g::date d, count(distinct pv.visitor) u, count(pv.id) v from generate_series((t-29)::timestamp, t::timestamp, interval '1 day') g
        left join page_views pv on pv.day = g::date group by g) x),
    'monthly', (select coalesce(json_agg(json_build_object('m', m, 'u', u, 'v', v) order by m), '[]') from (
        select to_char(g, 'YYYY-MM') m, count(distinct pv.visitor) u, count(pv.id) v
        from generate_series(date_trunc('month', t::timestamp) - interval '11 months', date_trunc('month', t::timestamp), interval '1 month') g
        left join page_views pv on date_trunc('month', pv.day::timestamp) = g group by g) x),
    'pages', (select coalesce(json_agg(json_build_object('k', path, 'n', n) order by n desc), '[]') from (
        select path, count(*) n from page_views where day >= t-29 group by path order by n desc limit 8) x),
    'sources', (select coalesce(json_agg(json_build_object('k', source, 'n', n) order by n desc), '[]') from (
        select source, count(distinct visitor) n from page_views where day >= t-29 and source <> 'sivusto' group by source) x),
    'devices', (select coalesce(json_agg(json_build_object('k', device, 'n', n) order by n desc), '[]') from (
        select device, count(distinct visitor) n from page_views where day >= t-29 group by device) x)
  ) into r;
  return r;
end $$;
grant execute on function visit_stats() to authenticated;

-- Vanhat rivit (yli 2 vuotta) voi poistaa tarvittaessa:
-- delete from page_views where day < now() - interval '2 years';
