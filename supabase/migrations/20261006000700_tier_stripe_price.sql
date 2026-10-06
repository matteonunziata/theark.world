-- Day and week passes charge a Stripe product instead of the old MightySales
-- link. User decision, 2026-10-06.
-- stripe_price_id: the Stripe price a pass charges. Found from the product with
-- the tier's name ("Day Pass", "Week Pass") the first time it's needed, or
-- picked in Memberships → Tiers. The tier's price and currency follow Stripe's.
alter table public.membership_tiers
  add column if not exists stripe_price_id text;
