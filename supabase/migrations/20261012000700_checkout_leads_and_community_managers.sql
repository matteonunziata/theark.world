-- Checkout is open to admins, shop staff, division leads and community
-- managers. Same function bodies as before; only the role list changes.
-- (checkout_sale needs no change: it checks the role through checkout_price.)
-- Community managers also read the products and sales the Farm shop pages show.

drop policy "Read products" on public.products;
create policy "Read products" on public.products
  for select to authenticated using (public.has_role('admin', 'lead', 'shop', 'community_manager'));

drop policy "Read sales" on public.sales;
create policy "Read sales" on public.sales for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales', 'community_manager'));
drop policy "Read sale items" on public.sale_items;
create policy "Read sale items" on public.sale_items for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales', 'community_manager'));
drop policy "Read sale payments" on public.sale_payments;
create policy "Read sale payments" on public.sale_payments for select to authenticated
  using (public.has_role('admin', 'lead', 'shop', 'sales', 'community_manager'));

create or replace function public.shop_discount_for(cid uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case when public.has_role('admin', 'lead', 'shop', 'community_manager') then coalesce((
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
  where public.has_role('admin', 'lead', 'shop', 'community_manager') and length(trim(p_q)) >= 2
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
  where c.id = cid and public.has_role('admin', 'lead', 'shop', 'community_manager');
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
  if not public.has_role('admin', 'lead', 'shop', 'community_manager') then
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
  if not public.has_role('admin', 'lead', 'shop', 'community_manager') then
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
