-- A person's activity across the business: what they bought, booked and
-- paid for. Income in finance and farm shop sales can now name the person;
-- tickets, stays, court bookings and guest passes already do (by contact or,
-- for tickets and stays, by email). contact_activity() gathers it all for
-- the CRM profile, for anyone who can read that contact.

alter table public.finance_entries
  add column contact_id uuid references public.contacts (id) on delete set null;
create index finance_entries_contact_idx on public.finance_entries (contact_id) where contact_id is not null;

alter table public.stock_movements
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column amount numeric check (amount >= 0);
create index stock_movements_contact_idx on public.stock_movements (contact_id) where contact_id is not null;

-- Shop staff pick who bought something without seeing the rest of the CRM.
create or replace function public.shop_contact_search(q text)
returns table (id uuid, name text, email text, tier text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.email::text, c.tier
  from public.contacts c
  where public.has_role('admin', 'lead', 'shop')
    and length(trim(q)) >= 2
    and (c.name ilike '%' || trim(q) || '%'
      or c.email::text ilike '%' || trim(q) || '%'
      or c.phone ilike '%' || trim(q) || '%')
  order by c.name
  limit 8;
$$;
revoke all on function public.shop_contact_search(text) from public, anon;
grant execute on function public.shop_contact_search(text) to authenticated;

-- Whether a contact gets member prices (shop staff can't read contacts).
create or replace function public.is_active_member(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contacts
    where id = cid and tier is not null and membership_status = 'active'
      and public.has_role('admin', 'lead', 'shop')
  );
$$;
revoke all on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

create or replace function public.contact_activity(cid uuid)
returns table (
  at timestamptz,
  area text,
  title text,
  detail text,
  amount numeric,
  currency text,
  status text,
  link text
)
language sql stable security definer set search_path = ''
as $$
  with c as (
    select * from public.contacts where id = cid and public.can_read_contact(cid)
  )
  -- Membership
  select c.member_since::timestamp at time zone 'America/Costa_Rica', 'Membership', 'Became a member',
         coalesce(t.name, c.tier), null::numeric, null::text, c.membership_status, null::text
  from c left join public.membership_tiers t on t.key = c.tier
  where c.member_since is not null

  union all
  -- Money received, from Finance (dues, shop, food & drink, tuition, ...)
  select f.entry_date::timestamp at time zone 'America/Costa_Rica', coalesce(bl.name, 'Payment'),
         coalesce(nullif(f.description, ''), nullif(f.category, ''), 'Payment'),
         nullif(concat_ws(', ', f.category, f.reference), ''),
         f.amount, f.currency, f.status, null
  from c join public.finance_entries f on f.contact_id = c.id and f.kind = 'income'
  left join public.business_lines bl on bl.id = f.business_line_id

  union all
  -- Farm shop sales
  select m.created_at, 'Farm shop',
         p.name || case when -m.delta <> 1 then ' × ' || trim(to_char(-m.delta, 'FM999990.##')) else '' end,
         p.unit, m.amount, 'CRC', 'paid', null
  from c join public.stock_movements m on m.contact_id = c.id and m.type = 'sale'
  join public.products p on p.id = m.product_id

  union all
  -- Classes and events
  select (r.session_date + coalesce(o.start_time, '00:00')) at time zone 'America/Costa_Rica', 'Classes & events',
         o.title,
         nullif(concat_ws(', ', tt.name, case when r.checked_in_at is not null then 'came' end), ''),
         nullif(tt.price, 0), tt.currency,
         case when r.paid then 'paid' else 'booked' end,
         '/t/' || r.qr_token || '?look=1'
  from c join public.registrations r
    on r.contact_id = c.id or (r.contact_id is null and c.email is not null and r.email = c.email)
  join public.offerings o on o.id = r.offering_id
  left join public.ticket_types tt on tt.id = r.ticket_type_id

  union all
  -- Stays
  select (s.check_in + time '15:00') at time zone 'America/Costa_Rica', 'Hospitality',
         coalesce(l.listing_title, l.home_name, l.name, 'Lot ' || l.code),
         (s.check_out - s.check_in) || ' nights, ' || s.guests || ' guests',
         nullif(s.total, 0), s.currency,
         case when s.status = 'confirmed' and s.paid then 'paid' else s.status end,
         '/hospitality/' || l.id
  from c join public.stays s
    on (s.contact_id = c.id or (s.contact_id is null and c.email is not null and s.email = c.email))
   and s.kind = 'guest'
  join public.lots l on l.id = s.lot_id

  union all
  -- Court bookings
  select (b.date + b.start_time) at time zone 'America/Costa_Rica', 'Courts', ct.name,
         to_char(b.start_time, 'HH24:MI') || '–' || to_char(b.end_time, 'HH24:MI'),
         null, null, b.status, null
  from c join public.court_bookings b on b.contact_id = c.id
  join public.courts ct on ct.id = b.court_id

  union all
  -- Guests they invited
  select g.visit_date::timestamp at time zone 'America/Costa_Rica', 'Guests', 'Invited ' || g.guest_name, null,
         null, null, g.status, null
  from c join public.guest_passes g on g.host_contact_id = c.id

  union all
  -- Visits through security
  select e.entered_at, 'Visits', 'Came in', null, null, null, null, null
  from c join public.gate_entries e on e.contact_id = c.id

  order by 1 desc
  limit 500;
$$;
revoke all on function public.contact_activity(uuid) from public, anon;
grant execute on function public.contact_activity(uuid) to authenticated;
