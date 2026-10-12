-- Farm shop Checkout, round 2.
--  1. Every sale also writes an income line in Finance (Farm shop), whatever
--     the payment method, in the same transaction as the sale and the stock
--     movements. The line is linked to the sale so it can't be written twice.
--  2. Checkout can add a person who isn't in the CRM yet.
-- Stock already follows the sale: checkout_sale writes a stock_movements row
-- per line and the stock_movements_apply trigger takes it off products.stock.

alter table public.finance_entries
  add column sale_id uuid references public.sales (id) on delete set null;
create unique index finance_entries_sale_idx on public.finance_entries (sale_id) where sale_id is not null;

-- Writes the Finance line for a sale. Not linked to the contact: the person's
-- profile already lists the sale from its stock movements, and linking both
-- would show it twice.
create or replace function public.checkout_finance_entry(p_sale uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.sales;
  pay public.sale_payments;
  v_name text;
  v_items text;
begin
  select * into s from public.sales where id = p_sale;
  select * into pay from public.sale_payments where sale_id = p_sale order by created_at limit 1;
  if s.id is null or pay.id is null or s.total <= 0 then return; end if;
  select name into v_name from public.contacts where id = s.contact_id;
  select string_agg(i.name || case when i.quantity <> 1 then ' × ' || trim(to_char(i.quantity, 'FM999990.##')) else '' end, ', ' order by i.name)
    into v_items from public.sale_items i where i.sale_id = p_sale;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, created_by, sale_id
  ) values (
    'income', (s.created_at at time zone 'America/Costa_Rica')::date,
    (select id from public.business_lines where name = 'Farm shop' order by position limit 1),
    'Farm shop sales', coalesce(v_name, 'Walk-in'),
    left('Farm shop: ' || coalesce(v_items, 'sale'), 300),
    s.total, 'CRC',
    case pay.method when 'cash' then 'cash' when 'sinpe' then 'sinpe' else 'card' end,
    pay.reference, 'paid', s.staff_id, p_sale)
  on conflict (sale_id) where sale_id is not null do nothing;
end $$;
revoke all on function public.checkout_finance_entry(uuid) from public, anon, authenticated;

-- checkout_sale, now also writing the Finance line.
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

  perform public.checkout_finance_entry(v_sale);

  return q || jsonb_build_object('sale_id', v_sale, 'change_due', v_change);
end $$;
revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric) from public, anon;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric) to authenticated;

-- Sales made before this change.
select public.checkout_finance_entry(id) from public.sales;

-- ── Add a person from Checkout ───────────────────────────────────────────────
-- The shop role can't write to the CRM, so this adds a plain contact. Someone
-- with the same email is returned instead of duplicated.

create or replace function public.checkout_add_customer(p_name text, p_email text, p_phone text)
returns table (id uuid, name text, email text, phone text, photo_path text,
               tier text, membership_status text, discount_percent numeric, has_card boolean,
               created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_created boolean := false;
begin
  if not public.has_role('admin', 'shop') then
    raise exception 'You don’t have access to Checkout.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter a name.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email.' using errcode = 'P0001';
  end if;
  if v_email is not null then
    select c.id into v_id from public.contacts c where c.email::text = v_email;
  end if;
  if v_id is null then
    insert into public.contacts (name, email, phone, type, source, created_by)
    values (trim(p_name), v_email, nullif(trim(coalesce(p_phone, '')), ''), 'contact', 'Farm shop',
            public.current_staff_id())
    returning contacts.id into v_id;
    v_created := true;
  end if;
  return query
    select c.id, c.name, c.email::text, c.phone, c.photo_path, ms.tier, ms.status,
           public.shop_discount_for(c.id), c.tilopay_card_token is not null, v_created
    from public.contacts c
    left join lateral (
      select m.tier, m.status from public.memberships m
      where m.contact_id = c.id and m.status in ('active', 'cancelled', 'pending')
      order by (m.status = 'active') desc, m.starts_on desc limit 1) ms on true
    where c.id = v_id;
end $$;
revoke all on function public.checkout_add_customer(text, text, text) from public, anon;
grant execute on function public.checkout_add_customer(text, text, text) to authenticated;
