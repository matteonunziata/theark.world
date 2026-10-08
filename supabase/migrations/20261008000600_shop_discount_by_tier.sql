-- The portal shop discount follows the same rule as the Shopify codes
-- (user decision, 2026-10-08): Monthly, 3 and 6 months get 10%, Annual 20%,
-- only while the membership is live (started, not ended; a cancelled
-- subscription runs to its end date). Passes, Team-only rules and personal
-- court discounts do not apply. Annual includes Team, who hold Annual.

create or replace function public.my_shop_discount()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(case m.tier
    when 'annual' then 20
    when 'standard' then 10
    when 'quarter' then 10
    when 'half' then 10
    else 0 end), 0)
  from public.memberships m
  where m.contact_id = public.current_member_contact_id()
    and m.status in ('active', 'cancelled')
    and m.starts_on <= (now() at time zone 'America/Costa_Rica')::date
    and (m.ends_on is null or m.ends_on >= (now() at time zone 'America/Costa_Rica')::date);
$$;
revoke all on function public.my_shop_discount() from public;
grant execute on function public.my_shop_discount() to authenticated;
