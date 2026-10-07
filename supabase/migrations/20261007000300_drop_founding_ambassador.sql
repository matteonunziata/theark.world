-- Founding and Ambassador are no longer membership tiers (user decision,
-- 2026-10-07). Nobody was on either. Team stays: staff are members through it.
-- The Shopify member codes now go by tier (Monthly, 3 months and 6 months get
-- member10, Annual gets member20), so Team gets none.

do $$
begin
  if exists (select 1 from public.memberships where tier in ('founding', 'ambassador')) then
    raise exception 'Someone is still on the Founding or Ambassador tier; move them first.';
  end if;
end $$;

-- contacts.tier and payments.tier become null if they pointed here.
delete from public.membership_tiers where key in ('founding', 'ambassador');
