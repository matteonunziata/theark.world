-- Farm shop Checkout: the in-person point of sale. A sale, its lines and its
-- payment are written in one transaction by checkout_sale(), together with a
-- stock_movements row per line (which the existing trigger applies to
-- products.stock). Prices and the member discount are worked out here, never
-- trusted from the browser. Everything is in colones.
--
-- stock_movements stays the single log of stock changes. Its `type` (sale /
-- restock / adjusted) is kept because the shop reports read it; `reason` adds
-- the finer label (shop_sale, shopify_order, internal_order, stock_received,
-- waste, count_adjustment).

alter table public.contacts add column tilopay_card_token text;
comment on column public.contacts.tilopay_card_token is
  'Tilopay saved-card token. Never a card number.';

alter table public.org_settings add column sinpe_number text;

alter table public.stock_movements
  add column reason text check (reason in (
    'shop_sale', 'shopify_order', 'internal_order', 'stock_received', 'waste', 'count_adjustment')),
  add column reference text,
  add column sale_id uuid;

update public.stock_movements set reason = case type
  when 'sale' then 'shop_sale' when 'restock' then 'stock_received' else 'count_adjustment' end;
update public.stock_movements m set reason = 'shopify_order'
where m.type = 'sale' and (
  exists (select 1 from public.shopify_orders s where s.id = m.order_id)
  or exists (select 1 from public.portal_shop_orders p where p.id = m.order_id));

-- Rows written by older code paths get a reason from their type.
create or replace function public.set_movement_reason()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reason is null then
    new.reason := case new.type
      when 'sale' then case when exists (select 1 from public.shopify_orders s where s.id = new.order_id)
                              or exists (select 1 from public.portal_shop_orders p where p.id = new.order_id)
                         then 'shopify_order' else 'shop_sale' end
      when 'restock' then 'stock_received'
      else 'count_adjustment' end;
  end if;
  return new;
end $$;
create trigger stock_movements_reason before insert on public.stock_movements
  for each row execute function public.set_movement_reason();

-- ── Sales ────────────────────────────────────────────────────────────────────

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  staff_id uuid references public.team_members (id) on delete set null,
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount_percent numeric(5, 2) not null default 0,
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  currency text not null default 'CRC' check (currency = 'CRC'),
  created_at timestamptz not null default now()
);
create index sales_contact_idx on public.sales (contact_id, created_at desc) where contact_id is not null;
create index sales_created_idx on public.sales (created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method text not null check (method in ('tilopay_account', 'bac_card', 'sinpe', 'cash')),
  -- BAC authorization code, SINPE reference, or Tilopay transaction id.
  reference text,
  amount numeric(14, 2) not null check (amount >= 0),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  cash_received numeric(14, 2),
  change_due numeric(14, 2),
  created_at timestamptz not null default now()
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index sale_payments_method_idx on public.sale_payments (created_at desc, method);

alter table public.stock_movements
  add constraint stock_movements_sale_fk foreign key (sale_id) references public.sales (id) on delete set null;

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
-- Read only; rows are written by checkout_sale() below. CRM roles read a
-- contact's sales for their profile.
create policy "Read sales" on public.sales for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales'));
create policy "Read sale items" on public.sale_items for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales'));
create policy "Read sale payments" on public.sale_payments for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales'));

-- ── Member discount ──────────────────────────────────────────────────────────
-- Same rule as the portal shop (my_shop_discount), for any contact: Monthly,
-- 3 and 6 months 10%, Annual 20%, while the membership is live. Passes and
-- non-members get nothing.

create or replace function public.shop_discount_for(cid uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case when public.has_role('admin', 'shop') then coalesce((
    select max(case m.tier when 'annual' then 20 when 'standard' then 10
                           when 'quarter' then 10 when 'half' then 10 else 0 end)
    from public.memberships m
    where m.contact_id = cid
      and m.status in ('active', 'cancelled')
      and m.starts_on <= (now() at time zone 'America/Costa_Rica')::date
      and (m.ends_on is null or m.ends_on >= (now() at time zone 'America/Costa_Rica')::date)), 0)
  else 0 end;
$$;
revoke all on function public.shop_discount_for(uuid) from public, anon;
grant execute on function public.shop_discount_for(uuid) to authenticated;

-- ── Customer search ──────────────────────────────────────────────────────────
-- The shop role can't read the CRM, so Checkout searches through this. It
-- never returns the card token, only whether one is on file.

create or replace function public.checkout_customers(p_q text)
returns table (id uuid, name text, email text, phone text, photo_path text,
               tier text, membership_status text, discount_percent numeric, has_card boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.email::text, c.phone, c.photo_path,
         ms.tier, ms.status, public.shop_discount_for(c.id), c.tilopay_card_token is not null
  from public.contacts c
  left join lateral (
    select m.tier, m.status from public.memberships m
    where m.contact_id = c.id and m.status in ('active', 'cancelled', 'pending')
    order by (m.status = 'active') desc, m.starts_on desc limit 1) ms on true
  where public.has_role('admin', 'shop') and length(trim(p_q)) >= 2
    and (c.name ilike '%' || trim(p_q) || '%'
         or c.email::text ilike '%' || trim(p_q) || '%'
         or (regexp_replace(p_q, '\D', '', 'g') <> ''
             and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'))
  order by c.name limit 12;
$$;
revoke all on function public.checkout_customers(text) from public, anon;
grant execute on function public.checkout_customers(text) to authenticated;

-- For the server-side Tilopay charge only.
create or replace function public.checkout_card_token(cid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.tilopay_card_token from public.contacts c
  where c.id = cid and public.has_role('admin', 'shop');
$$;
revoke all on function public.checkout_card_token(uuid) from public, anon;
grant execute on function public.checkout_card_token(uuid) to authenticated;

-- ── Pricing and the sale ─────────────────────────────────────────────────────

-- Prices a basket from the catalog and locks its products. p_lines is
-- [{ product_id, qty }]. Raises if anything is out of stock.
create or replace function public.checkout_price(p_contact uuid, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pct numeric := 0;
  l record;
  p public.products;
  v_lines jsonb := '[]';
  v_sub numeric := 0;
  v_disc numeric := 0;
  v_gross numeric;
  v_ld numeric;
begin
  if not public.has_role('admin', 'shop') then
    raise exception 'You don’t have access to Checkout.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one product.' using errcode = 'P0001';
  end if;
  if p_contact is not null then
    pct := public.shop_discount_for(p_contact);
  end if;

  for l in
    select (e ->> 'product_id')::uuid as pid, sum((e ->> 'qty')::numeric) as qty
    from jsonb_array_elements(p_lines) e group by 1 order by 1
  loop
    if l.qty is null or l.qty <= 0 then
      raise exception 'Every line needs a quantity.' using errcode = 'P0001';
    end if;
    select * into p from public.products where id = l.pid and active for update;
    if not found then
      raise exception 'One of the products is no longer in the shop.' using errcode = 'P0001';
    end if;
    if p.track_stock and p.stock < l.qty then
      raise exception '%', case when p.stock <= 0 then p.name || ' is out of stock.'
        else 'Only ' || trim(to_char(p.stock, 'FM999990.##')) || ' of ' || p.name || ' left.' end
        using errcode = 'P0001';
    end if;
    v_gross := round(p.price * l.qty);
    v_ld := round(v_gross * pct / 100);
    v_sub := v_sub + v_gross;
    v_disc := v_disc + v_ld;
    v_lines := v_lines || jsonb_build_object('product_id', p.id, 'name', p.name, 'qty', l.qty,
      'unit_price', p.price, 'gross', v_gross, 'discount', v_ld);
  end loop;

  return jsonb_build_object('lines', v_lines, 'subtotal', v_sub, 'discount_percent', pct,
    'discount', v_disc, 'total', v_sub - v_disc);
end $$;
revoke all on function public.checkout_price(uuid, jsonb) from public, anon;
grant execute on function public.checkout_price(uuid, jsonb) to authenticated;

-- One transaction: sale, items, payment, a stock movement per line.
create or replace function public.checkout_sale(
  p_contact uuid, p_lines jsonb, p_method text, p_reference text default null,
  p_cash_received numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q jsonb;
  v_sale uuid := gen_random_uuid();
  v_staff uuid := public.current_staff_id();
  v_total numeric;
  v_ref text := nullif(trim(coalesce(p_reference, '')), '');
  v_change numeric;
  l jsonb;
begin
  q := public.checkout_price(p_contact, p_lines);   -- also checks the role
  v_total := (q ->> 'total')::numeric;

  if p_method not in ('tilopay_account', 'bac_card', 'sinpe', 'cash') then
    raise exception 'Choose how it was paid.' using errcode = 'P0001';
  end if;
  if p_method = 'tilopay_account' and (p_contact is null or public.checkout_card_token(p_contact) is null) then
    raise exception 'This customer has no saved card.' using errcode = 'P0001';
  end if;
  if p_method <> 'cash' and v_ref is null then
    raise exception '%', case p_method when 'bac_card' then 'Enter the BAC authorization code.'
      when 'sinpe' then 'Enter the SINPE reference.' else 'The card payment has no transaction id.' end
      using errcode = 'P0001';
  end if;
  if p_method = 'cash' then
    if p_cash_received is null or p_cash_received < v_total then
      raise exception 'The cash received is less than the total.' using errcode = 'P0001';
    end if;
    v_change := p_cash_received - v_total;
  end if;

  insert into public.sales (id, contact_id, staff_id, subtotal, discount_percent, discount, total)
  values (v_sale, p_contact, v_staff, (q ->> 'subtotal')::numeric, (q ->> 'discount_percent')::numeric,
          (q ->> 'discount')::numeric, v_total);

  for l in select * from jsonb_array_elements(q -> 'lines') loop
    insert into public.sale_items (sale_id, product_id, name, quantity, unit_price, discount)
    values (v_sale, (l ->> 'product_id')::uuid, l ->> 'name', (l ->> 'qty')::numeric,
            (l ->> 'unit_price')::numeric, (l ->> 'discount')::numeric);
    insert into public.stock_movements
      (product_id, type, reason, delta, by_id, contact_id, amount, unit_price, method, order_id, sale_id, reference)
    values ((l ->> 'product_id')::uuid, 'sale', 'shop_sale', -((l ->> 'qty')::numeric), v_staff, p_contact,
            (l ->> 'gross')::numeric - (l ->> 'discount')::numeric, (l ->> 'unit_price')::numeric,
            case p_method when 'sinpe' then 'sinpe' when 'cash' then 'cash' else 'card' end,
            v_sale, v_sale, v_ref);
  end loop;

  insert into public.sale_payments (sale_id, method, reference, amount, cash_received, change_due)
  values (v_sale, p_method, v_ref, v_total, p_cash_received, v_change);

  return q || jsonb_build_object('sale_id', v_sale, 'change_due', v_change);
end $$;
revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric) from public, anon;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric) to authenticated;
