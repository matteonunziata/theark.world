-- The public Farm shop (/farm-shop): anyone can buy without signing in. Orders
-- reuse portal_shop_orders; a guest order has no contact, only the name and
-- email typed at checkout. Signed-in members still get their discount.

alter table public.portal_shop_orders
  alter column contact_id drop not null,
  add column guest_name text,
  add column guest_email text,
  add constraint portal_shop_orders_buyer check (contact_id is not null or guest_email is not null);

-- The catalog without the member gate: only what is for sale online, no
-- stock counts or costs. Same rows as shop_catalog().
create or replace function public.public_shop_catalog()
returns table (
  external_id text,
  name text,
  product_group text,
  variant text,
  category text,
  price numeric,
  image_url text,
  description text,
  web_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.external_id, p.name, coalesce(p.product_group, p.name), p.variant, p.category,
         p.price, p.image_url, p.description, p.web_url
  from public.products p
  where p.active and p.online is true and p.external_id is not null
  order by p.category, 3, p.price;
$$;
revoke all on function public.public_shop_catalog() from public;
grant execute on function public.public_shop_catalog() to anon, authenticated;

-- Settle an order once. A guest whose email matches a contact is linked to
-- that contact, so the purchase shows on their CRM profile; nobody is created.
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
  v_contact uuid;
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

  v_contact := o.contact_id;
  if v_contact is null and o.guest_email is not null then
    select c.id into v_contact from public.contacts c where c.email = o.guest_email::extensions.citext;
  end if;

  update public.portal_shop_orders
  set status = 'paid', paid_at = now(), stripe_session_id = p_session, stripe_payment_intent = p_intent,
      contact_id = v_contact
  where id = p_order;

  for l in select * from jsonb_array_elements(o.lines) loop
    select id into v_product from public.products where external_id = l ->> 'id' limit 1;
    if v_product is not null then
      insert into public.stock_movements (product_id, type, delta, contact_id, unit_price, amount, method, order_id)
      values (v_product, 'sale', -((l ->> 'qty')::numeric), v_contact, (l ->> 'unit')::numeric,
              round((l ->> 'unit')::numeric * (l ->> 'qty')::numeric, 2), 'card', o.id);
    end if;
  end loop;

  return query select true, v_contact;
end;
$$;
revoke all on function public.record_shop_order_paid(uuid, text, text) from public, anon, authenticated;
