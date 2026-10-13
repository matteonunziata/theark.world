-- The public lot prices page and the "lots remaining" counts read the real estate inventory.
-- Only what the website shows: lot number, kind, status, size, price while it's for sale, features.
-- No owners, no photos, no notes. Rentals are left out (they are not for sale).
create or replace function public.public_lots()
returns table (
  code text,
  name text,
  kind text,
  status text,
  size_m2 numeric,
  price numeric,
  currency text,
  features text,
  estate_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.code,
    l.name,
    l.kind,
    l.status,
    l.size_m2,
    case when l.status = 'available' then l.price end,
    l.currency,
    l.features,
    e.code
  from public.lots l
  left join public.lots e on e.id = l.estate_lot_id
  where l.kind in ('lot', 'estate', 'fractional')
  order by nullif(regexp_replace(l.code, '\D', '', 'g'), '')::int, l.code;
$$;

revoke all on function public.public_lots() from public;
grant execute on function public.public_lots() to anon, authenticated;
