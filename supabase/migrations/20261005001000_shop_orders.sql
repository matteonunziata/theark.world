-- Farm shop as a till. Lines bought together share an order, every sale says
-- how it was paid and at what price, and shop_report() totals the ledger by
-- day, product, category, method, hour, weekday and buyer, so the Overview can
-- show a quarter of sales without pulling every row through the API.

alter table public.stock_movements
  add column order_id uuid,
  add column method text check (method in ('cash', 'card', 'sinpe', 'transfer', 'other')),
  add column unit_price numeric(14, 2) check (unit_price >= 0);
comment on column public.stock_movements.order_id is
  'Lines sold together. Older sales without one count as an order each.';
comment on column public.stock_movements.unit_price is
  'Price charged per unit at the time (member or regular); amount = qty × unit_price.';

create index stock_movements_sales_idx on public.stock_movements (created_at desc)
  where type = 'sale';
create index stock_movements_order_idx on public.stock_movements (order_id)
  where order_id is not null;

-- Everything the Overview shows for a date range (Costa Rica calendar days),
-- plus the same totals for the period before it. Runs as the caller, so the
-- usual shop RLS applies and buyer names only come through for staff who can
-- read the CRM.
create or replace function public.shop_report(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
with bounds as (
  select (p_from::timestamp) at time zone 'America/Costa_Rica' as s,
         ((p_to + 1)::timestamp) at time zone 'America/Costa_Rica' as e,
         (p_to - p_from + 1) as len
),
sales as (
  select m.id, coalesce(m.order_id, m.id) as oid, m.product_id, -m.delta as qty,
         coalesce(m.amount, -m.delta * coalesce(m.unit_price, p.price)) as amount,
         m.method, m.contact_id, m.created_at,
         m.created_at at time zone 'America/Costa_Rica' as local,
         p.name, p.category, p.unit
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  cross join bounds b
  where m.type = 'sale' and m.created_at >= b.s and m.created_at < b.e
),
prev as (
  select coalesce(sum(coalesce(m.amount, -m.delta * coalesce(m.unit_price, p.price))), 0) as revenue,
         count(distinct coalesce(m.order_id, m.id)) as orders,
         coalesce(sum(-m.delta), 0) as units
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  cross join bounds b
  where m.type = 'sale'
    and m.created_at >= b.s - make_interval(days => b.len) and m.created_at < b.s
),
buyers as (
  select contact_id, public.is_active_member(contact_id) as member
  from (select distinct contact_id from sales where contact_id is not null) c
),
orders as (
  select s.oid, min(s.created_at) as at, sum(s.amount) as amount, sum(s.qty) as units,
         count(*) as lines, max(s.method) as method, max(s.contact_id::text)::uuid as contact_id,
         string_agg(
           s.name || case when s.qty <> 1 then ' × ' || trim(to_char(s.qty, 'FM999990.##')) else '' end,
           ', ' order by s.amount desc) as summary
  from sales s group by s.oid
)
select jsonb_build_object(
  'totals', (select jsonb_build_object(
      'revenue', coalesce(sum(s.amount), 0),
      'orders', count(distinct s.oid),
      'units', coalesce(sum(s.qty), 0),
      'member_revenue', coalesce(sum(s.amount) filter (where b.member), 0),
      'member_orders', count(distinct s.oid) filter (where b.member),
      'buyers', count(distinct s.contact_id))
    from sales s left join buyers b on b.contact_id = s.contact_id),
  'prev', (select to_jsonb(p) from prev p),
  'days', (select coalesce(jsonb_agg(jsonb_build_object('day', x.d, 'revenue', x.r, 'orders', x.o, 'units', x.u) order by x.d), '[]'::jsonb)
    from (select local::date as d, sum(amount) as r, count(distinct oid) as o, sum(qty) as u from sales group by 1) x),
  'categories', (select coalesce(jsonb_agg(jsonb_build_object('category', x.c, 'revenue', x.r, 'units', x.u) order by x.r desc), '[]'::jsonb)
    from (select category as c, sum(amount) as r, sum(qty) as u from sales group by 1) x),
  'products', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'category', x.category, 'unit', x.unit,
      'revenue', x.r, 'units', x.u, 'orders', x.o, 'last_sold', x.l) order by x.r desc), '[]'::jsonb)
    from (select product_id as id, name, category, unit, sum(amount) as r, sum(qty) as u, count(distinct oid) as o, max(created_at) as l
          from sales group by 1, 2, 3, 4) x),
  'methods', (select coalesce(jsonb_agg(jsonb_build_object('method', x.m, 'revenue', x.r, 'orders', x.o) order by x.r desc), '[]'::jsonb)
    from (select coalesce(method, 'unknown') as m, sum(amount) as r, count(distinct oid) as o from sales group by 1) x),
  'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', x.h, 'revenue', x.r, 'orders', x.o) order by x.h), '[]'::jsonb)
    from (select extract(hour from local)::int as h, sum(amount) as r, count(distinct oid) as o from sales group by 1) x),
  'weekdays', (select coalesce(jsonb_agg(jsonb_build_object('dow', x.w, 'revenue', x.r, 'orders', x.o) order by x.w), '[]'::jsonb)
    from (select extract(dow from local)::int as w, sum(amount) as r, count(distinct oid) as o from sales group by 1) x),
  'buyers', (select coalesce(jsonb_agg(jsonb_build_object('id', x.contact_id, 'name', c.name, 'member', x.member, 'revenue', x.r, 'orders', x.o) order by x.r desc), '[]'::jsonb)
    from (select s.contact_id, bool_or(b.member) as member, sum(s.amount) as r, count(distinct s.oid) as o
          from sales s join buyers b on b.contact_id = s.contact_id
          group by 1 order by 3 desc limit 8) x
    left join public.contacts c on c.id = x.contact_id),
  'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', o.oid, 'at', o.at, 'amount', o.amount, 'units', o.units, 'lines', o.lines,
      'method', o.method, 'buyer', c.name, 'summary', o.summary) order by o.at desc), '[]'::jsonb)
    from (select * from orders order by at desc limit 12) o
    left join public.contacts c on c.id = o.contact_id)
);
$$;
revoke all on function public.shop_report(date, date) from public, anon;
grant execute on function public.shop_report(date, date) to authenticated;

-- Stock only ever changes through the ledger, so after sample movements are
-- removed the counts are rebuilt from what's left. Admins only.
create or replace function public.shop_recount_stock()
returns void
language sql security definer set search_path = ''
as $$
  update public.products p
  set stock = greatest(0, coalesce(
    (select sum(m.delta) from public.stock_movements m where m.product_id = p.id), 0))
  where public.has_role('admin');
$$;
revoke all on function public.shop_recount_stock() from public, anon;
grant execute on function public.shop_recount_stock() to authenticated;

-- Sample sales: thirteen weeks of orders across the catalog, deliveries twice
-- a week, busier at weekends and slowly growing, paid in cash, SINPE and by
-- card, some by the sample members. Every row is listed in sample_records so
-- Settings → "Remove sample data" clears it (and recounts stock).
do $$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
  staff uuid[] := array(select id from public.team_members where role = 'shop' order by name);
  members uuid[] := array(
    select c.id from public.contacts c
    join public.sample_records s on s.table_name = 'contacts' and s.record_id = c.id::text
    where c.type in ('member', 'steward') order by c.name);
  others uuid[] := array(
    select c.id from public.contacts c
    join public.sample_records s on s.table_name = 'contacts' and s.record_id = c.id::text
    where c.type = 'contact' order by c.name);
  names text[] := array[
    'Farm Eggs · 12', 'Farm Eggs · 18', 'Farm Eggs · 30',
    'Mixed Greens', 'Kale', 'Tropical Spinach', 'Organic cucumbers', 'Bok Choi', 'Dragon Fruit', 'Roman Basil',
    'Plant Milk · liter / Cashew', 'Plant Milk · half liter / Cashew', 'Plant Milk · liter / Macadamia', 'Cashew Labneh', 'Vegan Cream Cheese',
    'Cold Brew', 'Musa Coffee · Small Package 250 gr.', 'Musa Coffee · Large Package 500 gr.',
    'Kimchi', 'Sauerkraut', 'Green Pesto', 'Chimichurri', 'Baba Ganoush', 'Mango and red basil jam', 'Spicy Oil', 'Vegetable broth',
    'Brownie', 'LOVE bar', 'Nopal Tortillas', 'Boiled Eggs', 'Flavored Chips',
    'Natural Ginger Ale · half liter', 'Turmeric Soda · half liter', 'Natural Electrolyte Soda · half liter',
    'Herbal Iced Tea · half liter / Herbal', 'Digestive Iced Tea · half liter / Digestive',
    'Moringa Powder', 'Super Greens', 'Natural Supplement Capsules · Green Power',
    'Dried farm herbs · Dried Oregano', 'Italian Spice',
    'Hand made ceramics', 'Shoping Tote Bags · Tote WAVES', 'Laundry detergent sheets · Scent free'];
  -- Average units a day for each product above.
  demand numeric[] := array[
    3.0, 1.2, 0.8,
    2.5, 1.8, 1.5, 2.0, 1.0, 1.2, 0.8,
    1.3, 1.5, 0.7, 0.6, 0.5,
    2.2, 0.5, 0.3,
    0.9, 0.7, 0.8, 0.5, 0.4, 0.4, 0.3, 0.4,
    1.6, 1.2, 0.8, 0.9, 0.7,
    1.4, 1.1, 1.3, 0.9, 0.7,
    0.3, 0.3, 0.15,
    0.3, 0.3,
    0.08, 0.2, 0.2];
  pid uuid[]; price numeric[];
  n int := array_length(names, 1);
  nstaff int := coalesce(array_length(staff, 1), 0);
  tot numeric := 0;
  i int; d int; k int; j int; lines int; norders int; h int; wd int;
  day date; at timestamptz; oid uuid; mid uuid; buyer uuid; meth text;
  qty numeric; r numeric; w numeric;
begin
  if not exists (select 1 from public.products where active) then return; end if;
  for i in 1..n loop
    select p.id, p.price into mid, r from public.products p where p.name = names[i] and p.active limit 1;
    pid[i] := mid; price[i] := r;
    if mid is not null then tot := tot + demand[i]; end if;
    mid := null;
  end loop;
  if tot = 0 then return; end if;
  perform setseed(0.42);

  -- Start counting these products, with a first delivery thirteen weeks ago.
  for i in 1..n loop
    if pid[i] is null then continue; end if;
    update public.products set track_stock = true, low_at = greatest(2, ceil(demand[i] * 4))
    where id = pid[i] and not track_stock;
    insert into public.stock_movements (product_id, type, delta, by_id, created_at)
    values (pid[i], 'restock', ceil(demand[i] * 14) + 2,
      case when nstaff > 0 then staff[1 + (i % nstaff)] end,
      ((today - 91) + make_time(7, 30 + (i % 29), 0)) at time zone 'America/Costa_Rica')
    returning id into mid;
    insert into public.sample_records values ('stock_movements', mid::text);
  end loop;

  for d in reverse 90..0 loop
    day := today - d;
    wd := extract(dow from day)::int;

    -- Deliveries on Tuesdays and Fridays, a little more than sells.
    if wd in (2, 5) then
      for i in 1..n loop
        if pid[i] is null then continue; end if;
        w := demand[i] * 3.8 * (0.7 + random() * 0.6);
        if w < 0.5 then continue; end if;
        insert into public.stock_movements (product_id, type, delta, by_id, created_at)
        values (pid[i], 'restock', ceil(w),
          case when nstaff > 0 then staff[1 + (i % nstaff)] end,
          (day + make_time(7, 10 + (i % 45), 0)) at time zone 'America/Costa_Rica')
        returning id into mid;
        insert into public.sample_records values ('stock_movements', mid::text);
      end loop;
    end if;

    -- Orders: busier at weekends, slowly growing over the quarter.
    norders := round((7 + case when wd in (0, 6) then 5 when wd = 5 then 2 else 0 end)
      * (1 + (90 - d) / 300.0) * (0.75 + random() * 0.5));
    for k in 1..norders loop
      oid := gen_random_uuid();
      lines := 1 + floor(random() * random() * 4)::int;
      h := 7 + floor(power(random(), 1.6) * 11)::int;
      at := (day + make_time(h, floor(random() * 60)::int, floor(random() * 60)::int)) at time zone 'America/Costa_Rica';
      r := random();
      buyer := case
        when r < 0.40 and members <> '{}' then members[1 + floor(random() * array_length(members, 1))::int]
        when r < 0.52 and others <> '{}' then others[1 + floor(random() * array_length(others, 1))::int]
      end;
      r := random();
      meth := case when r < 0.36 then 'cash' when r < 0.70 then 'sinpe' when r < 0.95 then 'card' else 'transfer' end;
      for j in 1..lines loop
        w := random() * tot;
        i := 1;
        while i < n and (pid[i] is null or w > demand[i]) loop
          if pid[i] is not null then w := w - demand[i]; end if;
          i := i + 1;
        end loop;
        if pid[i] is null then continue; end if;
        qty := case when random() < 0.8 then 1 else 2 end;
        insert into public.stock_movements
          (product_id, type, delta, by_id, contact_id, amount, unit_price, method, order_id, created_at)
        values (pid[i], 'sale', -qty,
          case when nstaff > 0 then staff[1 + (k % nstaff)] end,
          buyer, qty * price[i], price[i], meth, oid, at)
        returning id into mid;
        insert into public.sample_records values ('stock_movements', mid::text);
      end loop;
    end loop;
  end loop;
end $$;
