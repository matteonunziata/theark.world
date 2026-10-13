-- Checkout sales never reached Shopify: checkout_sale() didn't set
-- shopify_pending, so the next stock sync saw Shopify's higher count and put
-- the sold units back ("Set to Shopify's count" adjustments). Now every
-- Checkout stock movement is flagged and sent, like the older sale screens.

-- checkout_sale, now flagging its stock movements to go to Shopify.
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
      (product_id, type, reason, delta, by_id, contact_id, amount, unit_price, method, order_id, sale_id, reference, shopify_pending)
    values ((l ->> 'product_id')::uuid, 'sale', 'shop_sale', -((l ->> 'qty')::numeric), v_staff, p_contact,
            (l ->> 'gross')::numeric - (l ->> 'discount')::numeric, (l ->> 'unit_price')::numeric,
            case p_method when 'sinpe' then 'sinpe' when 'cash' then 'cash' else 'card' end,
            v_sale, v_sale, v_ref, true);
  end loop;

  insert into public.sale_payments (sale_id, method, reference, amount, cash_received, change_due)
  values (v_sale, p_method, v_ref, v_total, p_cash_received, v_change);

  perform public.checkout_finance_entry(v_sale);

  return q || jsonb_build_object('sale_id', v_sale, 'change_due', v_change);
end $$;
revoke all on function public.checkout_sale(uuid, jsonb, text, text, numeric) from public, anon;
grant execute on function public.checkout_sale(uuid, jsonb, text, text, numeric) to authenticated;

-- Today's Digestive Iced Tea sale (ref 214108) is still unsent: send it.
update public.stock_movements set shopify_pending = true
where id = '24d79def-661d-42e9-998d-d4360f1d0c66' and not shopify_pending;

-- Five units the 17:14 sync put back although they were sold at Checkout
-- (Herbal Iced Tea ref 102194; Eggs 12, Baba Ganoush, Nopal Tortillas,
-- Italian Spice ref K3P6SA). Take them off again, here and in Shopify.
insert into public.stock_movements (product_id, type, delta, reference, shopify_pending)
select p.id, 'adjusted', -1, 'Correction: Checkout sale not sent to Shopify', true
from public.products p
where p.name in ('Herbal Iced Tea · half liter / Herbal', 'Farm Eggs · 12', 'Baba Ganoush', 'Nopal Tortillas', 'Italian Spice');
