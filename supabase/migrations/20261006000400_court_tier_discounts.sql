-- Court discounts come from the membership tier (user decision, 2026-10-06):
-- 10% off court bookings for memberships of a month or longer, 20% for
-- Annual, nothing on passes. A personal discount on the contact (e.g. Jungle
-- Ventures) still applies when it is higher. Members pay when they book.

alter table public.membership_tiers
  add column court_discount numeric(5, 2) not null default 0
  check (court_discount >= 0 and court_discount <= 100);

update public.membership_tiers set court_discount = 10
where key in ('standard', 'founding', 'quarter', 'half', 'ambassador', 'team');
update public.membership_tiers set court_discount = 20 where key = 'annual';

-- The discount a contact gets on courts: the tier's, or a higher personal one.
create or replace function public.court_discount_for(p_contact uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(greatest(t.court_discount, d.percent), t.court_discount, d.percent, 0)
  from public.contacts x
  left join public.membership_tiers t
    on t.key = x.tier and x.membership_status = 'active'
  left join public.discounts d on d.id = x.discount_id and d.active
  where x.id = p_contact;
$$;

create or replace function public.court_price(p_court uuid, p_minutes int, p_contact uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce(c.price, 0) * (p_minutes::numeric / c.slot_minutes)
      * (1 - coalesce(public.court_discount_for(p_contact), 0) / 100),
    case when c.currency = 'USD' then 2 else 0 end)
  from public.courts c
  where c.id = p_court;
$$;

-- What the signed-in member saves on courts, for showing prices. 0 for anyone else.
create or replace function public.my_court_discount()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.court_discount_for(public.current_member_contact_id()), 0);
$$;

revoke all on function public.court_discount_for(uuid) from public, anon;
revoke all on function public.my_court_discount() from public;
grant execute on function public.court_discount_for(uuid) to authenticated;
grant execute on function public.my_court_discount() to anon, authenticated;
