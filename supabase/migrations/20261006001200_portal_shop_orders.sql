-- Orders placed in the member portal's Farm shop. A member fills a basket,
-- pays on Stripe, and picks the order up at The ARK. The order row is made
-- when they press Pay (pending) and settled when Stripe says it's paid; the
-- paid order is then created in Shopify so stock, picking and reports stay
-- there. Sales also land in the shop's ledger (stock_movements), like a till
-- sale, so the Overview counts them.

create table public.portal_shop_orders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- [{ "id": Shopify variant id, "name", "label", "qty", "list": price, "unit": member price }]
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount_percent numeric(5, 2) not null default 0,
  total numeric(14, 2) not null check (total >= 0),
  currency text not null default 'CRC',
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  paid_at timestamptz,
  shopify_order_id text,
  shopify_order_name text,
  -- Why the paid order isn't in Shopify yet, for the team to act on.
  shopify_error text,
  created_at timestamptz not null default now()
);
create index portal_shop_orders_contact_idx on public.portal_shop_orders (contact_id, created_at desc);

alter table public.portal_shop_orders enable row level security;
-- Members read their own; shop staff read all. Writes go through the server
-- (service role) and the function below.
create policy "Read shop orders" on public.portal_shop_orders
  for select to authenticated
  using (contact_id = public.current_member_contact_id() or public.has_role('admin', 'lead', 'shop'));

-- Mark an order paid, once, and put its lines in the sales ledger.
create or replace function public.record_shop_order_paid(p_order uuid, p_session text, p_intent text)
returns table (created boolean, contact_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o public.portal_shop_orders;
  l jsonb;
  v_product uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('shop-order:' || p_order::text, 0));
  select * into o from public.portal_shop_orders where id = p_order for update;
  if not found then
    raise exception 'Unknown shop order %.', p_order using errcode = 'P0001';
  end if;
  if o.status = 'paid' then
    return query select false, o.contact_id;
    return;
  end if;

  update public.portal_shop_orders
  set status = 'paid', paid_at = now(), stripe_session_id = p_session, stripe_payment_intent = p_intent
  where id = p_order;

  for l in select * from jsonb_array_elements(o.lines) loop
    select id into v_product from public.products where external_id = l ->> 'id' limit 1;
    if v_product is not null then
      insert into public.stock_movements (product_id, type, delta, contact_id, unit_price, amount, method, order_id)
      values (v_product, 'sale', -((l ->> 'qty')::numeric), o.contact_id, (l ->> 'unit')::numeric,
              round((l ->> 'unit')::numeric * (l ->> 'qty')::numeric, 2), 'card', o.id);
    end if;
  end loop;

  return query select true, o.contact_id;
end;
$$;
revoke all on function public.record_shop_order_paid(uuid, text, text) from public, anon, authenticated;
