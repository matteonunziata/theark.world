-- Online orders from Shopify (thearkfarm.shop) come into ARK OS, so the farm
-- shop Overview counts web sales and till sales together. One row per Shopify
-- order, kept up to date as the order changes; its lines go into the sales
-- ledger (stock_movements) while the order is paid and live, and come out
-- again if it is cancelled, voided or refunded in full.
--
-- Orders made in the member portal are already in the ledger when they are
-- paid (and are then sent to Shopify), so they are recorded here as
-- "portal" and never counted a second time.

create table public.shopify_orders (
  id uuid primary key default gen_random_uuid(),
  -- Shopify's order id (the gid:// string).
  shopify_id text not null unique,
  name text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  email text,
  currency text not null default 'CRC',
  total numeric(14, 2) not null default 0,
  -- Shopify's displayFinancialStatus: PAID, PENDING, REFUNDED, VOIDED, ...
  financial_status text not null,
  cancelled_at timestamptz,
  ordered_at timestamptz not null,
  tags text[] not null default '{}',
  -- [{ "variant": numeric id, "title", "qty", "unit", "amount" }]
  lines jsonb not null default '[]' check (jsonb_typeof(lines) = 'array'),
  -- Made in the member portal: already in the ledger, never counted here.
  portal boolean not null default false,
  -- Its lines are in the sales ledger right now.
  ledgered boolean not null default false,
  -- Lines that matched no product in the catalog (not in the ledger).
  unmatched integer not null default 0,
  updated_at timestamptz not null default now()
);
create index shopify_orders_contact_idx on public.shopify_orders (contact_id);
create index shopify_orders_ordered_idx on public.shopify_orders (ordered_at desc);

alter table public.shopify_orders enable row level security;
-- Shop staff read; writes go through the server (service role) and the function below.
create policy "Read shopify orders" on public.shopify_orders
  for select to authenticated
  using (public.has_role('admin', 'lead', 'shop'));

-- Record or update one Shopify order, and keep the ledger in step with it.
-- Safe to run again with the same order: it only changes what changed.
-- p: { shopify_id, name, email, contact_id, currency, total, status,
--      cancelled_at, ordered_at, tags[], portal, method, lines[] }
create or replace function public.record_shopify_order(p jsonb)
returns table (action text, unmatched integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sid text := p ->> 'shopify_id';
  o public.shopify_orders;
  v_portal boolean := coalesce((p ->> 'portal')::boolean, false);
  v_cancelled timestamptz := nullif(p ->> 'cancelled_at', '')::timestamptz;
  v_status text := p ->> 'status';
  v_live boolean;
  v_method text := coalesce(p ->> 'method', 'card');
  l jsonb;
  v_product uuid;
  v_miss integer := 0;
begin
  if sid is null or sid = '' then
    raise exception 'A Shopify order needs an id.' using errcode = 'P0001';
  end if;
  if v_method not in ('cash', 'card', 'sinpe', 'transfer', 'other') then
    v_method := 'other';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shopify-order:' || sid, 0));

  -- Counted while paid and not cancelled. A partial refund stays counted in full.
  v_live := not v_portal and v_cancelled is null
    and v_status in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED');

  select * into o from public.shopify_orders where shopify_id = sid for update;
  if not found then
    insert into public.shopify_orders
      (shopify_id, name, contact_id, email, currency, total, financial_status,
       cancelled_at, ordered_at, tags, lines, portal)
    values
      (sid, coalesce(p ->> 'name', sid), nullif(p ->> 'contact_id', '')::uuid, nullif(p ->> 'email', ''),
       coalesce(p ->> 'currency', 'CRC'), coalesce((p ->> 'total')::numeric, 0), coalesce(v_status, 'PENDING'),
       v_cancelled, coalesce(nullif(p ->> 'ordered_at', '')::timestamptz, now()),
       coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
       coalesce(p -> 'lines', '[]'), v_portal)
    returning * into o;
  else
    update public.shopify_orders
    set financial_status = coalesce(v_status, financial_status),
        cancelled_at = v_cancelled,
        total = coalesce((p ->> 'total')::numeric, total),
        contact_id = coalesce(nullif(p ->> 'contact_id', '')::uuid, contact_id),
        email = coalesce(nullif(p ->> 'email', ''), email),
        tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), tags),
        updated_at = now()
    where id = o.id
    returning * into o;
  end if;

  if v_portal then
    return query select 'portal'::text, 0;
    return;
  end if;

  if v_live and not o.ledgered then
    for l in select * from jsonb_array_elements(o.lines) loop
      select id into v_product from public.products where external_id = (l ->> 'variant') limit 1;
      if v_product is null then
        v_miss := v_miss + 1;
      else
        insert into public.stock_movements
          (product_id, type, delta, contact_id, unit_price, amount, method, order_id, created_at)
        values
          (v_product, 'sale', -((l ->> 'qty')::numeric), o.contact_id, (l ->> 'unit')::numeric,
           (l ->> 'amount')::numeric, v_method, o.id, o.ordered_at);
      end if;
    end loop;
    update public.shopify_orders set ledgered = true, unmatched = v_miss where id = o.id;
    return query select 'imported'::text, v_miss;
    return;
  end if;

  if not v_live and o.ledgered then
    -- Cancelled, voided or refunded since: take its sales back out.
    delete from public.stock_movements where order_id = o.id;
    update public.shopify_orders set ledgered = false where id = o.id;
    return query select 'reversed'::text, 0;
    return;
  end if;

  return query select 'unchanged'::text, o.unmatched;
end;
$$;
revoke all on function public.record_shopify_order(jsonb) from public, anon, authenticated;
